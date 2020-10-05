function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {
  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let rvp = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
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
    eventDispatcher: dispatcher,
    formEl: document.getElementById("form"),
    robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
    showProgressBar: true,
    theme: 'dark',
    submitCallback: function() {
      let formDataSerialized = conversationalForm.getFormData(true);
      conversationalForm.addRobotChatResponse('Give me one second to sign them up!');
      $.ajax({
        url: `https://us-central1-fir-app-141ad.cloudfunctions.net/signUpAuto`,
        dataType: "json",
        method: 'POST',
        crossDomain: true,
        data: {
          formData: formDataSerialized,
          rvpAgent: rvp
        },
        success: function() {
          changeProgressBar('#00FF00');
          conversationalForm.addRobotChatResponse("The client should soon recieve a text message to finish the form");
          setTimeout(function() { 
            window.location.replace('https://bigbips.com/');
          }, 3500);
        },
        error: function() {
          changeProgressBar('#FF0000');
          conversationalForm.addRobotChatResponse("Hmmm, looks like something went wrong.");
          setTimeout(function() { 
            location.reload();
          }, 3500);
        }
      });
    }
  });
};