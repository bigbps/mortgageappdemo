function changeProgressBar(color) {
  $( '.bar' ).each(function () {
    this.style.setProperty( 'background-color', color, 'important' );
  });
}

window.onload = function() {

  let data = {};
  let pushObject = {};
  let signaturePad;
  let signaturePadPrimary;
  let signaturePadSecondary;
  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let parameterValue = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let name = decodeURIComponent(window.location.search.match(/(\?|&)name\=([^&]*)/)[2]);
  let dispatcher = new cf.EventDispatcher();
  let maskedFields = ['homeBudget', 'downBudget', 'grossEarnings', 'currentYearBase', 'currentYearSelf', 'currentYear', 'prevYear', 'creditDebt', 'monthlyDebt', 'grossEarningsCoApp', 'currentYearCoAppBase', 'currentYearCoAppSelf', 'currentYearCoApp', 'prevYearCoApp', 'creditDebtCoApp', 'monthlyDebtCoApp'];
  dispatcher.addEventListener(cf.FlowEvents.FLOW_UPDATE, function(event) {
    if (maskedFields.includes(event.detail.tag.name)) {
      $('input').mask("000,000,000,000,000", { reverse: true });
    } 
    else if (event.detail.tag.name === "percent") {
      $('input').mask('00%', { reverse: true });
    }
    else {
      $('input').unmask();
    }
  }, false);

  dispatcher.addEventListener(cf.FlowEvents.USER_INPUT_INVALID, function(event) {
    if (event.type === "cf-flow-user-input-invalid") {
      changeProgressBar('#FF0000')
      setTimeout(function() { 
        changeProgressBar('#40E9FF');
      }, 2000);
    }
  }, false);
  
  $( ".welcome" ).append( `<cf-robot-message cf-questions='Hello ${name}, you are receiving this message because your Agent has referred you to The BigBPS Express Pre-Approval. The process will take about 3 - 5 minutes to complete. You will receive your Mortgage Approval into your email within 2 - 5 minutes afterwards. If you do not receive your Approval, check your Spam/Junk Mailbox or message us at 1-833-466-3469 to notify us. Thank you for the opportunity for BigBPS to serve your financing needs.'</cf-robot-message>` );

  let conversationalForm = new cf.ConversationalForm({
    dictionaryData: {
      "user-reponse-missing": "No Apartment Number",
    },
    eventDispatcher: dispatcher,
    formEl: document.getElementById("form"),
    robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
    showProgressBar: true,
    theme: 'dark',
    flowStepCallback: function(dto, success, error) {
      console.log(dto);
      if (maskedFields.includes(dto.tag.name)) {
        pushObject[dto.tag.name] = parseFloat(dto.text.replace(/\D/g,''));
      } else {
        pushObject[dto.tag.name] = dto.text;
      }
      if (dto.tag.id === "downBudget") {
        console.log(dto.input.cfReference.tags);
        console.log(dto.input);
        console.log(dto);
        let purchaseBudget = dto.input.cfReference.tags[23].value.replace(/\D/g,'');
        let percentBudget = ((dto.text.replace(/\D/g,'')) / purchaseBudget) * 100;
        if (percentBudget > 100) {
          conversationalForm.addRobotChatResponse(
            "Down payment budget is bigger than budgeted purchase price!"
          );
          return error();
        } else {
          if (purchaseBudget <= 1000000) {
            if (percentBudget < 5) {
              conversationalForm.addRobotChatResponse(
                "Down payment budget must be greater than 5% of the budgeted purchase price!"
              );
              return error();
            } else {
              return success();
            }
          }
          if (purchaseBudget > 1000000) {
            if (percentBudget < 20) {
              conversationalForm.addRobotChatResponse(
                "Down payment budget must be greater than 20% of the budgeted purchase price because the budgeted purchase price is greater than 1 million!"
              );
              return error();
            } else {
              return success();
            }
          }
        }
      } else if (dto.tag.name === "primaryDOB" || dto.tag.name === "secondaryApplicantDOB") {
        if (! /^[0-9]{8}$/.test(dto.text)) {
          conversationalForm.addRobotChatResponse(
            "Please follow date format: YYYYMMDD"
          );
          return error();
        } else {
            if (parseFloat(dto.text.substring(4, 6)) < 1 || parseFloat(dto.text.substring(4, 6)) > 12) {
              conversationalForm.addRobotChatResponse(
                "Invalid date!"
              );
              return error();
            } else if (parseFloat(dto.text.substring(6, 8)) < 1 || parseFloat(dto.text.substring(6, 8)) > 31) {
              conversationalForm.addRobotChatResponse(
                "Invalid date!"
              );
              return error();
            } else if (parseFloat(dto.text.substring(4, 6)) === 2 && parseFloat(dto.text.substring(6, 8)) > 28) {
              conversationalForm.addRobotChatResponse(
                "Invalid date!"
              );
              return error();
            } else if ((parseFloat(dto.text.substring(4, 6)) === 4 || parseFloat(dto.text.substring(4, 6)) === 6 || parseFloat(dto.text.substring(4, 6)) === 9 || parseFloat(dto.text.substring(4, 6)) === 11) && parseFloat(dto.text.substring(6, 8)) > 30) {
              conversationalForm.addRobotChatResponse(
                "Invalid date!"
              );
              return error();
            }
            else {
              return success();
            }
          }
      }
      else if (dto.tag.name === "percent") {
        let percentage = dto.text.replace(/\D/g,'');
        console.log(percentage);
        if (parseFloat(percentage) < 5) {
          conversationalForm.addRobotChatResponse(
            "Down Payment budget must be greater than 5% of the budgeted purchase price!"
          );
          return error();
        } else {
          return success();
        }
      }
      else {
        return success();
      }
    },
    submitCallback: function() {
      pushObject.fnceObj = 'Express Pre Approval';
      let formDataSerialized = conversationalForm.getFormData(true);
      conversationalForm.addRobotChatResponse('Thanks. The last thing is to verify your information and then provide your consent for authorizing us to inquire your credit and manage your confidential information to proceed with your application.');
      if (formDataSerialized.referral[0] === 'Single') {
        $('#confirm-modal-single').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
        $('input').unmask();
        $("#dob, #address, #city, #postal, #apt").prop("disabled", true);
        $('#edit').on('click', function() {
          $("#dob, #address, #city, #postal, #apt").prop("disabled", !$("#dob").prop("disabled"));
        });
        $('#dob').val(pushObject.primaryDOB);
        $('#address').val(pushObject.primaryAddress);
        $('#city').val(pushObject.primaryCity);
        $('#postal').val(pushObject.primaryPostal);
        if (!pushObject.apt) {
          $('#apt').val('None');
        } else {
          $('#apt').val(pushObject.apt);
        }
      } else {
          $('#confirm-modal-coapp').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
          $('input').unmask();
          $("#dobPrim, #addressPrim, #cityPrim, #postalPrim, #aptPrim, #name, #dobCoApp, #addressCoApp, #cityCoApp, #postalCoApp, #aptCoApp").prop("disabled", true);
          $('#edit-coapp').on('click', function() {
            $("#dobPrim, #addressPrim, #cityPrim, #postalPrim, #aptPrim, #name, #dobCoApp, #addressCoApp, #cityCoApp, #postalCoApp, #aptCoApp").prop("disabled", !$("#dobPrim").prop("disabled"));
          });
          $('#dobPrim').val(pushObject.primaryDOB);
          $('#addressPrim').val(pushObject.primaryAddress);
          $('#cityPrim').val(pushObject.primaryCity);
          $('#postalPrim').val(pushObject.primaryPostal);
          if (!pushObject.apt) {
            $('#aptPrim').val('None');
          } else {
            $('#aptPrim').val(pushObject.apt);
          }
          $('#name').val(pushObject.secondaryApplicantFirstName + ' ' + pushObject.secondaryApplicantLastName);
          $('#dobCoApp').val(pushObject.secondaryApplicantDOB);
          pushObject.secondaryApplicantEmail = pushObject.secondaryApplicantFirstName + '.' + pushObject.secondaryApplicantLastName + '@nomail.ca';
          pushObject.secondaryApplicantMobile = '999-999-9999';
          if (pushObject.coappAdd === 'Enter a different address') {
            $('#addressCoApp').val(pushObject.coAppAddress);
            $('#cityCoApp').val(pushObject.coAppCity);
            $('#postalCoApp').val(pushObject.coAppPostal);
            if (!pushObject.coAppApt) {
              $('#aptCoApp').val('None');
            } else {
              $('#aptCoApp').val(pushObject.coAppApt);
            }
          } else {
            $('#addressCoApp').val(pushObject.primaryAddress);
            $('#cityCoApp').val(pushObject.primaryCity);
            $('#postalCoApp').val(pushObject.primaryPostal);
            if (!pushObject.apt) {
              $('#aptCoApp').val('None');
            } else {
              $('#aptCoApp').val(pushObject.apt);
            }
          }
        }
        $('#submit-verify, #submit-verify-coapp').on('click', function() {
          $.modal.close();
          if (formDataSerialized.referral[0] === 'Single') {
            pushObject.primaryDOB = $('#dob').val();
            pushObject.primaryAddress = $('#address').val();
            pushObject.primaryCity = $('#city').val();
            pushObject.primaryPostal = $('#postal').val();
            if (pushObject.apt || $('#apt').val()) {
              pushObject.apt = $('#apt').val();
            }
          } else {
            pushObject.primaryDOB = $('#dobPrim').val();
            pushObject.primaryAddress = $('#addressPrim').val();
            pushObject.primaryCity = $('#cityPrim').val();
            pushObject.primaryPostal = $('#postalPrim').val();
            if (pushObject.apt || $('#aptPrim').val()) {
              pushObject.apt = $('#aptPrim').val();
            }
            pushObject.secondaryApplicantFirstName = $('#name').val().split(' ')[0];
            pushObject.secondaryApplicantLastName = $('#name').val().split(' ').pop();
            pushObject.secondaryApplicantDOB = $('#dobCoApp').val();
            if (pushObject.coappAdd === 'Enter a different address') {
              pushObject.coAppAddress = $('#addressCoApp').val();
              pushObject.coAppCity = $('#cityCoApp').val();
              pushObject.coAppPostal = $('#postalCoApp').val();
              if (pushObject.apt || $('#aptCoApp').val()) {
                pushObject.apt = $('#aptCoApp').val();
              }
            }
          }
        if (formDataSerialized.downEntry[0] === 'Percentage') {
          pushObject.downBudget = parseFloat(formDataSerialized.percent.replace(/\D/g,'') / 100) * pushObject.homeBudget;
          console.log(pushObject.downBudget);
          console.log(pushObject);
        }
        $('#form').hide();
        if (formDataSerialized.referral[0] === 'Single') {
          $('#consent-modal').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
          let canvas = document.getElementById("signature");
          signaturePad = new SignaturePad(canvas, {
            backgroundColor: "rgb(255,255,255)"
          });
          $('#clear-signature').on('click', function(){
            signaturePad.clear();
          });
        } else {
          $('#coapp-consent-modal').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
          let canvasPrimary = document.getElementById("signature-primary");
          signaturePadPrimary = new SignaturePad(canvasPrimary, {
            backgroundColor: "rgb(255,255,255)"
          });
          let canvasSecondary = document.getElementById("signature-coapp");
          signaturePadSecondary = new SignaturePad(canvasSecondary, {
            backgroundColor: "rgb(255,255,255)"
          });
          $('#clear-signature-primary').on('click', function() {
            signaturePadPrimary.clear();
          });
          $('#coapp-clear-signature').on('click', function() {
            signaturePadSecondary.clear();
          });
        }
        $('#submit, #submit-coapp').on('click', function() {
          if (formDataSerialized.referral[0] === 'Joint') {
            let primarySignature = signaturePadPrimary.toDataURL('image/jpeg');
            let coAppSignature = signaturePadSecondary.toDataURL('image/jpeg');
            data = {
              formData: pushObject,
              key: parameterValue,
              image: primarySignature,
              secondaryImage: coAppSignature
            }
          } else {
            let primarySignature = signaturePad.toDataURL('image/jpeg');
            console.log(pushObject);
            data = {
              formData: pushObject,
              key: parameterValue,
              image: primarySignature,
            }
          }
          $.modal.close();
          $.when($.ajax({
            url: `https://us-central1-fir-app-141ad.cloudfunctions.net/submitClient`,
            dataType: "json",
            method: 'POST',
            crossDomain: true,
            data: data,
            success: function() {
              console.log('Successful AJAX');
            },
            error: function() {
              conversationalForm.addRobotChatResponse('Oops, something went wrong! Please try again and ensure your fields are correct');
              changeProgressBar('#FF0000');
              setTimeout(function() { 
                changeProgressBar('#40E9FF');
                location.reload(); },
              4000);
            }
          })).then(() => {
            $.ajax({
              url: `https://us-central1-fir-app-141ad.cloudfunctions.net/addCredit`,
              dataType: "json",
              method: 'POST',
              crossDomain: true,
              data: {
                key: parameterValue,
              },
              success: function() {
                changeProgressBar('#00FF00');
                console.log('Successful Credit');
                conversationalForm.addRobotChatResponse('Thank you for the opportunity for BigBPS to serve your financing needs. You will receive a message or email in the next 5-10 minutes containing a preliminary approval assessment of your mortgage request. Please feel free to phone or message at 1-833-466-3469 if you have further questions. Talk to you soon!');
                setTimeout(function() { 
                  window.location.replace('https://bigbips.com/'); }, 
                5000);
              },
              error: function() {
                $( '.bar' ).each(function () {
                  this.style.setProperty( 'background-color', 'red', 'important' );
                });
                conversationalForm.addRobotChatResponse('Oops, something went wrong! Please contact us at 1-833-466-3469 so we can follow up with you!');
                setTimeout(function() { 
                  window.location.replace('https://bigbips.com/'); }, 
                4000);  
              }
            });
          });
        });
      });
    }
  });
}