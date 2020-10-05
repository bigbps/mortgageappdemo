function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {

  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let key = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let name = decodeURIComponent(window.location.search.match(/(\?|&)name\=([^&]*)/)[2]);
  let dispatcher = new cf.EventDispatcher();
  dispatcher.addEventListener(cf.FlowEvents.USER_INPUT_INVALID, function(event) {
    if (event.type === "cf-flow-user-input-invalid") {
      changeProgressBar('#FF0000');
      setTimeout(function() {
        changeProgressBar('#40E9FF');
      }, 2000);
    }
  }, false);

  $( ".welcome" ).append( `<cf-robot-message cf-questions='Hello ${name}, you have been approved to be a BigBPS Express Pre-Approval Agent! We just need you to fill out a bit of personal information!'</cf-robot-message>` );
  let conversationalForm = new cf.ConversationalForm({
    eventDispatcher: dispatcher,
    formEl: document.getElementById("form"),
    robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
    showProgressBar: true,
    theme: 'dark',
    submitCallback: function() {
      let formDataSerialized = conversationalForm.getFormData(true);
      conversationalForm.addRobotChatResponse('Give me one second to make sure you\'re all signed up.');
      $.ajax({
        url: `https://us-central1-fir-app-141ad.cloudfunctions.net/finishSignUp`,
        dataType: "json",
        method: 'POST',
        crossDomain: true,
        data: {
          formData: formDataSerialized,
          key: key
        },
        success: function() {
          changeProgressBar('#00FF00');
          conversationalForm.addRobotChatResponse("Thank you for your answers! You are now approved by BigBPS to refer clients!");
          setTimeout(function() { 
            window.location.replace('https://bigbips.com/');
          }, 3500);
        },
        error: function() {
          changeProgressBar('#FF0000');
          conversationalForm.addRobotChatResponse("Hmmm, looks like something went wrong!");
          setTimeout(function() { 
            location.reload();
          }, 3500);
        }
      });
    }
  });
};