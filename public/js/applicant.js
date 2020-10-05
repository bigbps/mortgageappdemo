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
  let parameterValue = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let name = decodeURIComponent(window.location.search.match(/(\?|&)name\=([^&]*)/)[2]);
  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let dispatcher = new cf.EventDispatcher();
  let maskedFields = ['homeBudget', 'downBudget', 'grossEarnings', 'currentYearBase', 'currentYearSelf', 'prevYearSelf', 'currentYear', 'prevYear', 'creditDebt', 'monthlyDebt', 'grossEarningsCoApp', 'currentYearCoAppBase', 'currentYearCoAppSelf', 'prevYearCoAppSelf', 'currentYearCoApp', 'prevYearCoApp', 'creditDebtCoApp', 'monthlyDebtCoApp', 'purchaseValue', 'downPayment', 'originalPrice', 'marketPrice', 'equity', 'mortgageBalance', 'locBalance'];
  dispatcher.addEventListener(cf.FlowEvents.FLOW_UPDATE, function(event) {
    if (maskedFields.includes(event.detail.tag.name)) {
      $('input').mask("000,000,000,000,000", { reverse: true });
    } 
    else if (event.detail.tag.name === "percent") {
      $('input').mask('00%', { reverse: true });
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

  $( ".welcome" ).append( `<cf-robot-message cf-questions='Hello ${name}, welcome to BigBPS Mortgage.'</cf-robot-message>` );

  let base64;
  let base64CoApp;
  let conversationalForm = new cf.ConversationalForm({
    dictionaryData: {
      "user-reponse-missing": "No Apartment Number",
    },
    eventDispatcher: dispatcher,
    formEl: document.getElementById("form"),
    robotImage: 'https://i.ibb.co/GvTv6Br/favi.png',
    showProgressBar: true,
    theme: 'dark',
    flowStepCallback: function(dto, success) {
      if (dto.tag.name === "fileUpload") {
        let reader = new FileReader();
        reader.onload = () => {
          base64 = reader.result;
          console.log(base64);
          let param = ({ file: base64, prov: 'auto' });
          $.ajax({
            url: 'https://us-central1-transunion-interaction.cloudfunctions.net/processLicenseHTTPS',
            dataType: "json",
            method: 'POST',
            contentType: 'application/json',
            crossDomain: true,
            data: JSON.stringify({ data: param }),
            success: function(data) {
              console.log('Successful AJAX');
              console.log(data);
              pushObject.primaryApplicantFirstName = data.result.response.firstName;
              pushObject.primaryApplicantLastName = data.result.response.lastName;
              pushObject.primaryDOB = data.result.response.dob;
              pushObject.primaryAddress = data.result.response.civic + ' ' + data.result.response.street;
              pushObject.primaryCity = data.result.response.city;
              pushObject.primaryPostal = data.result.response.postal;
            },
            })
          };
        reader.readAsDataURL(dto.controlElements[0].files[0]);
        $('input').val('');
        return success();
      }
      if (dto.tag.name === "fileUploadCoApp") {
        let reader = new FileReader();
        reader.onload = () => {
          base64CoApp = reader.result;
          console.log(base64CoApp);
          let param = ({ file: base64CoApp, prov: 'auto' });
          $.ajax({
            url: 'https://us-central1-transunion-interaction.cloudfunctions.net/processLicenseHTTPS',
            dataType: "json",
            method: 'POST',
            contentType: 'application/json',
            crossDomain: true,
            data: JSON.stringify({ data: param }),
            success: function(data) {
              console.log('Successful AJAX');
              console.log(data);
              pushObject.secondaryApplicantFirstName = data.result.response.firstName;
              pushObject.secondaryApplicantLastName = data.result.response.lastName;
              pushObject.secondaryApplicantDOB = data.result.response.dob;
              pushObject.coAppAddress = data.result.response.civic + ' ' + data.result.response.street;
              pushObject.coAppCity = data.result.response.city;
              pushObject.coAppPostal = data.result.response.postal;
            },
          })
        };
        console.log(dto.controlElements[0].files);
        reader.readAsDataURL(dto.controlElements[0].files[0]);
        $('input').val('');
        return success();
      }
      if (maskedFields.includes(dto.tag.name)) {
        pushObject[dto.tag.name] = parseFloat(dto.text.replace(/\D/g,''));
      } else {
        pushObject[dto.tag.name] = dto.text;
      }
      if (dto.tag.id === "downBudget") {
        let purchasePrice = dto.input.cfReference.tags.find(obj => obj.name === "homeBudget");
        purchasePrice = purchasePrice.value.replace(/\D/g,'');
        let percent = (dto.text.replace(/\D/g,'') / purchasePrice) * 100;
        if (percent > 100) {
          conversationalForm.addRobotChatResponse(
            "Down payment is bigger than purchase price!"
          );
          return error();
        } else {
          if (purchasePrice <= 1000000) {
            if (percent < 5) {
              conversationalForm.addRobotChatResponse(
                "Down payment must be greater than 5% of the purchase price!"
              );
              return error();
            } else {
              return success();
            }
          }
          if (purchasePrice > 1000000) {
            if (percent < 20) {
              conversationalForm.addRobotChatResponse(
                "Down payment must be greater than 20% of the purchase price because the purchase price is greater than 1 million!"
              );
              return error();
            } else {
              return success();
            }
          }
        }
      } 
      else if (dto.tag.name === "primaryDOB" || dto.tag.name === "secondaryApplicantDOB" || dto.tag.name === "oopDate" || dto.tag.name === "fnceCompDate" || dto.tag.name === "possessionDate") {
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
        else if (dto.tag.id === "downPayment") {
          let purchaseBudget = dto.input.cfReference.tags[53].value.replace(/\D/g,'');
          let percentBudget = (dto.text.replace(/\D/g,'') / purchaseBudget) * 100;
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
        }
        else if (dto.tag.name === "percent") {
          let percentage = dto.text.replace(/\D/g,'');
          if (parseFloat(percentage) < 5) {
            conversationalForm.addRobotChatResponse(
              "Down Payment budget must be greater than 5% of the budgeted purchase price!"
            );
            return error();
          } else {
            return success();
          }
        } else {
          return success();
        }
      },
    submitCallback: function() {
      let formDataSerialized = conversationalForm.getFormData(true);
      console.log(pushObject);
      conversationalForm.addRobotChatResponse('Thanks. The last thing is to provide your consent for authorizing us to inquire your credit and manage your confidential information to proceed with your application.');
      if (formDataSerialized.referral[0] === 'Single') {
        $('#confirm-modal-single').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
        $('input').unmask();
        $("#prim, #dob, #address, #city, #postal, #apt").prop("disabled", true);
        $('#edit').on('click', function() {
          $("#prim, #dob, #address, #city, #postal, #apt").prop("disabled", !$("#dob").prop("disabled"));
        });
        $('#prim').val(pushObject.primaryApplicantFirstName + ' ' + pushObject.primaryApplicantLastName);
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
          $("#primName, #dobPrim, #addressPrim, #cityPrim, #postalPrim, #aptPrim, #name, #dobCoApp, #addressCoApp, #cityCoApp, #postalCoApp, #aptCoApp").prop("disabled", true);
          $('#edit-coapp').on('click', function() {
            $("#primName, #dobPrim, #addressPrim, #cityPrim, #postalPrim, #aptPrim, #name, #dobCoApp, #addressCoApp, #cityCoApp, #postalCoApp, #aptCoApp").prop("disabled", !$("#dobPrim").prop("disabled"));
          });
          $('#primName').val(pushObject.primaryApplicantFirstName + ' ' + pushObject.primaryApplicantLastName);
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
          if (pushObject.coappAdd === 'Enter a different address' || pushObject.licenseCoApp === 'License') {
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
            pushObject.primaryApplicantFirstName = $('#prim').val().split(' ')[0];
            pushObject.primaryApplicantLastName = $('#prim').val().split(' ').pop();
            pushObject.primaryDOB = $('#dob').val();
            pushObject.primaryAddress = $('#address').val();
            pushObject.primaryCity = $('#city').val();
            pushObject.primaryPostal = $('#postal').val();
            if (pushObject.apt || $('#apt').val()) {
              pushObject.apt = $('#apt').val();
            }
          } else {
            pushObject.primaryApplicantFirstName = $('#primName').val().split(' ')[0];
            pushObject.primaryApplicantLastName = $('#primName').val().split(' ').pop();
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
        $('#form').hide();
        if (formDataSerialized.downEntry[0] === 'Percentage') {
          pushObject.downBudget = ((parseFloat(formDataSerialized.percent.replace(/\D/g,'')) / 100) * pushObject.homeBudget).toFixed(0);
        }
        if (formDataSerialized.referral[0] === 'Single') {
          $('#consent-modal').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
          let canvas = document.getElementById("signature");
          signaturePad = new SignaturePad(canvas, {
            backgroundColor: "#FFFFFF"
          });
          $('#clear-signature').on('click', function(){
            signaturePad.clear();
          });
        } else {
          $('#coapp-consent-modal').modal({ fadeDuration: 500, showClose: false, escapeClose: false });
          let canvasPrimary = document.getElementById("signature-primary");
          signaturePadPrimary = new SignaturePad(canvasPrimary, {
            backgroundColor: "#FFFFFF"
          });
          let canvasSecondary = document.getElementById("signature-coapp");
          signaturePadSecondary = new SignaturePad(canvasSecondary, {
            backgroundColor: "#FFFFFF"
          });
          $('#clear-signature-primary').on('click', function(){
            signaturePadPrimary.clear();
          });
          $('#coapp-clear-signature').on('click', function(){
            signaturePadSecondary.clear();
          });
        }
        $('#submit, #submit-coapp').on('click', function(){
          if (formDataSerialized.referral[0] === 'Joint') {
            let primarySignature = signaturePadPrimary.toDataURL();
            let coAppSignature = signaturePadSecondary.toDataURL();
            data = {
              formData: pushObject,
              key: parameterValue,
              image: primarySignature,
              secondaryImage: coAppSignature
            }
          } else {
            let primarySignature = signaturePad.toDataURL();
            data = {
              formData: pushObject,
              key: parameterValue,
              image: primarySignature,
            }
          }
          $.modal.close();
          console.log(pushObject);
          if (environment !== "production") {
            let score = {
                creditSum: {
                  balance: '0',
                  creditLimit: '5000',
                  highCredit: '0',
                  monthlyPayment: '0',
                  pastDue: '0'
                },
                iPayment: '0',
                rBalance: '0',
                score: '790'
            }
            pushObject.score = score;
          }
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
              changeProgressBar('#FF0000');
              conversationalForm.addRobotChatResponse('Oops, something went wrong! Please try again and ensure your fields are correct');
              setTimeout(function() { 
                changeProgressBar('#40E9FF');
                location.reload(); }, 
              4000);
            }
          })).then(() => {
            if (environment === "production") {
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
                conversationalForm.addRobotChatResponse('Thank you for the opportunity for BigBPS to serve your financing needs. You will receive a message or email in the next 5-10 minutes containing a preliminary approval assessment of your mortgage request. Please feel free to phone or message at 1-833-466-3469 if you have further questions. Talk to you soon!');
                setTimeout(function() { 
                  window.location.replace('https://www.bigbps.com'); }, 
                6200);
              },
              error: function() {
                changeProgressBar('#FF0000');
                conversationalForm.addRobotChatResponse('Oops, something went wrong!. Please contact us at 1-833-466-3469 so we can follow up with you!');
                setTimeout(function() { 
                  window.location.replace('https://www.bigbps.com'); }, 
                4000);
              }
            });
          } else {
            changeProgressBar('#00FF00');
              conversationalForm.addRobotChatResponse('Thank you for the opportunity for BigBPS to serve your financing needs. You will receive a message or email in the next 4-10 minutes containing a preliminary approval assessment of your mortgage request. Please feel free to phone or message at 1-833-466-3469 if you have further questions. Talk to you soon!');
              setTimeout(function() { 
                window.location.replace('https://www.bigbps.com'); }, 
              6200);
            }
          });
        });
      });
    }
  });
}