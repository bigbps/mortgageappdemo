function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {

  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let authenticated = false;
  let agentName;
  let flag = 'Other';
  let RVP;
  let parameterValue = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let dispatcher = new cf.EventDispatcher();
  dispatcher.addEventListener(cf.FlowEvents.USER_INPUT_INVALID, function(event) {
    if (event.type === "cf-flow-user-input-invalid") {
      changeProgressBar('#FF0000');
      setTimeout(function() {
        changeProgressBar('#40E9FF');
      }, 2000);
    }
  }, false);

  $.when($.ajax({
    url: `https://us-central1-fir-app-141ad.cloudfunctions.net/checkStatus`,
    dataType: "json",
    method: 'POST',
    crossDomain: true,
    data: {
      id: parameterValue,
    },
    success: function(data) {
      if (data.data.status === 'Activated') {
        authenticated = true;
      }
      flag = (data.data.flag === "Realtor") ? 'Realtor' : 'Other';
      agentMobile = data.data.mobile;
      agentName = data.data.firstName + ' ' + data.data.lastName;
      RVP = data.data.refferedBy;
      console.log(data.data);
    },
    error: function() {
      authenticated = false;
    }
  })).then(() => {
    if (authenticated) {
      $('.approved').show();
      $('#form').attr('cf-form');
      $( ".welcome" ).append( `<cf-robot-message cf-questions='Welcome ${agentName.split(' ')[0]}! This referral process will allow you to forward your client a very simple mortgage application.'</cf-robot-message>` );
      let conversationalForm = new cf.ConversationalForm({
        eventDispatcher: dispatcher,
        formEl: document.getElementById("form"),
        robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
        showProgressBar: true,
        theme: 'dark',
        submitCallback: function() {
          let formDataSerialized = conversationalForm.getFormData(true);
          $('#confirm-modal').modal({ fadeDuration: 1000, showClose: false, escapeClose: false });
          $("#phone").prop("disabled", true);
          $('#edit').on('click', function() {
            $("#phone").prop("disabled", !$("#phone").prop("disabled"));
          });
          $('#phone').val(formDataSerialized.primaryApplicantMobile);
          $('#submit').on('click', function() {
            $.modal.close();
            formDataSerialized.primaryApplicantMobile = $('#phone').val();
            console.log(formDataSerialized);
            $.ajax({
              url: `https://us-central1-fir-app-141ad.cloudfunctions.net/registerApplicants`,
              dataType: "json",
              method: 'POST',
              crossDomain: true,
              data: {
                flag: flag,
                formData: formDataSerialized,
                agentCode: agentMobile,
                agentName: agentName,
                RVP: RVP
              },
              success: function() {
                changeProgressBar('#00FF00');
                conversationalForm.addRobotChatResponse("Thank you! You have completed the referral process. A mortgage application link has been sent to your client’s mobile phone. If your client(s) does not receive the application, please message us at 1-833-466-3469 and we will resend as soon as possible.");
                setTimeout(function() { 
                  window.location.replace('https://bigbips.com/');
                }, 5000);
              },
              error: function() {
                changeProgressBar('#FF0000');
                conversationalForm.addRobotChatResponse("Hmmm, looks like something went wrong, maybe try again later!");
                setTimeout(function() { 
                  location.reload();
                }, 4000);
              }
            });
          }
        );
      }
    });
  } else {
      let element = document.getElementById('form');
      element.parentNode.removeChild(element);
      $('.pending').show();
    }
  });
}