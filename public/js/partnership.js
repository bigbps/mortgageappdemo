window.onload = function() {

  let getUrl = window.location;
  let baseUrl = getUrl .protocol + "//" + getUrl.host + "/" + getUrl.pathname.split('/')[1];
  let environment = baseUrl.includes('homehowmortgage.co') ? 'testing' : 'production';
  let parameterValue = decodeURIComponent(window.location.search.match(/(\?|&)id\=([^&]*)/)[2]);
  let canvas = document.getElementById("signature");
  signaturePad = new SignaturePad(canvas, {
    backgroundColor: "#FFFFFF"
  });
  $('#clear-signature').on('click', function(){
    signaturePad.clear();
  });
  $('#submit').on('click', function() {
    if (!signaturePad.isEmpty()) {
      $(this).replaceWith('<img src="./assets/loading.gif" style="height: 10px">');
      let partnerSignature = signaturePad.toDataURL('image/jpeg');
      data = {
        key: parameterValue,
        image: partnerSignature,
      }
      $.ajax({
        url: `https://us-central1-fir-app-141ad.cloudfunctions.net/partnershipConsent`,
        dataType: "json",
        method: 'POST',
        crossDomain: true,
        data: data,
        success: function() {
          window.location.replace('https://bigbips.com/');
        },
        error: function() {
          $('<span id="error" style="color: red; margin-left: 10px;">Hmmm, something went wrong!</span>').insertAfter(this);
        }
      });
    } else {
        if (!$('#error').length) {
          $('<span id="error" style="color: red; margin-left: 10px;">Cannot submit with no signature!</span>').insertAfter(this);
        }
        setTimeout(function() { 
          $('#error').remove();
        }, 3000);
      }
    });
}