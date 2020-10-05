function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {
  
  let pushObject = {};
  let parameterValue = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let dispatcher = new cf.EventDispatcher();
  let maskedFields = ['income', 'maximum'];
  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';

  dispatcher.addEventListener(cf.FlowEvents.FLOW_UPDATE, function(event) {
    if (maskedFields.includes(event.detail.tag.name)) {
      $('input').mask("000,000,000,000,000", { reverse: true });
    } else {
      $('input').unmask();
    }
  }, false);

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
    flowStepCallback: function(dto, success) {
      if (maskedFields.includes(dto.tag.name)) {
        pushObject[dto.tag.name] = parseFloat(dto.text.replace(/\D/g,''));
      } else {
        pushObject[dto.tag.name] = dto.text;
      }
      return success();
    },
    submitCallback: function() {
      $.ajax({
        url: `https://us-central1-fir-app-141ad.cloudfunctions.net/registerLead`,
        dataType: "json",
        method: 'POST',
        crossDomain: true,
        data: {
          mobileNumber: parameterValue,
          formData: pushObject
        },
        success: function() {
          changeProgressBar('#00FF00');
          conversationalForm.addRobotChatResponse("Thanks, we will send you the results in a minute");
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
}