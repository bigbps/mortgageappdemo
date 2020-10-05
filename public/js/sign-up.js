function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {

  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let mobileNumber = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let dispatcher = new cf.EventDispatcher();
  dispatcher.addEventListener(cf.FlowEvents.USER_INPUT_INVALID, function(event) {
    if (event.type === "cf-flow-user-input-invalid") {
      changeProgressBar('#FF0000');
      setTimeout(function() {
        changeProgressBar('#40E9FF');
      }, 2000);
    }
  }, false);

  let conversationalForm = new cf.ConversationalForm({
    dictionaryData: { "user-reponse-missing": "No agent code" },
    eventDispatcher: dispatcher,
    formEl: document.getElementById("form"),
    robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
    showProgressBar: true,
    theme: 'dark',
    submitCallback: function() {
      let formDataSerialized = conversationalForm.getFormData(true);
      conversationalForm.addRobotChatResponse('Give me one second to make sure you\'re all signed up.');
      $.ajax({
        url: `https://us-central1-fir-app-141ad.cloudfunctions.net/signUp`,
        dataType: "json",
        method: 'POST',
        crossDomain: true,
        data: {
          formData: formDataSerialized,
          mobileNumber: mobileNumber
        },
        success: function() {
          changeProgressBar('#00FF00');
          conversationalForm.addRobotChatResponse("Thank you for your answers! Our next step is to validate your information using our advanced system before your partnership is officially activated. We will be contacting you soon.");
          setTimeout(function() { 
            window.location.replace('https://bigbips.com/');
          }, 3500);
        },
        error: function() {
          changeProgressBar('#FF0000');
          conversationalForm.addRobotChatResponse("Hmmm, looks like something went wrong or you already have an account with us!");
          setTimeout(function() { 
            location.reload();
          }, 3500);
        }
      });
    }
  });
};