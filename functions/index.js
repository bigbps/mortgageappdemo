const functions   = require('firebase-functions');
const admin       = require('firebase-admin');
const cors        = require('cors')({ origin: true });
const superagent	= require('superagent');
const tuxml	      = require('./transunionXML');
const isgd        = require('isgd');
const api         = require('./node_modules/clicksend/api.js');
const smsApi      = new api.SMSApi('homehow', '2F4723BE-A1AB-E630-3C71-6A1B5B809773');

admin.initializeApp(functions.config().firebase);

/**
 * Upon the creation of an applicant within the Firebase database, this function
 * executes. It grabs the data of the newly created applicant, requests a credit
 * report for them, and then updates the database node with details from the 
 * TransUnion credit report.
 */
exports.addCredit = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`applicants/${request.body.key}`).once('value').then((data) => {
      let webhookURL = 'https://flow.zoho.com/685427162/flow/webhook/incoming?zapikey=1001.770a0a5da31334b4a966ea222c649fc6.a27f34daf397682355a5aedb45ae2053&isdebug=false';
      let object = data.val();
      let joint = data.val().referral === 'Yes' ? true : false;
      let sameAdd = data.val().coappAdd === 'Use same address as primary applicant' ? false : true;
      let client;
      let membercode = functions.config().tu.key;
      let pass = functions.config().tu.id;
      let url = functions.config().tu.url;
      let locBalance = data.val().locBalance ? parseFloat(data.val().locBalance) : 1;
      let creditDebt;
      let creditDebtCoApp;
      let iPay;
      let monthlyDebt;
      let iPayCoApp;
      let newCalculations = {};
      let newParentData = {};
      if (data.val().apt) {
        client = { fname: data.val().primaryApplicantFirstName, lname: data.val().primaryApplicantLastName, address: data.val().primaryAddress, dob: data.val().primaryDOB, province: data.val().primaryProvince, city: data.val().primaryCity, postal: data.val().primaryPostal, apt: data.val().apt }
      } else {
        client = { fname: data.val().primaryApplicantFirstName, lname: data.val().primaryApplicantLastName, address: data.val().primaryAddress, dob: data.val().primaryDOB, province: data.val().primaryProvince, city: data.val().primaryCity, postal: data.val().primaryPostal }
      }
      tuxml.getRecord(client, membercode, pass, url).then((data) => {
        let upObj	= {};

        if (data.type === 'SUCCESS') {

          let xml		= data.response;
          let scoreRegex	= /<Score>([0-9]*)<\/Score>/;
		      let sumRegex	= /<CreditSummaryDetail><Type>T<\/Type><HighCredit>0*([0-9]+|0)<\/HighCredit><CreditLimit>0*([0-9]+|0)<\/CreditLimit><Balance>0*([0-9]+|0)<\/Balance><PastDue>0*([0-9]+|0)<\/PastDue><MonthlyPayment>0*([0-9]+|0)<\/MonthlyPayment><\/CreditSummaryDetail>/;
		      let reportRegex	= /<TU_TTY_Report><\!\[CDATA\[((?:.|\n|\r)*?)\]\]><\/TU_TTY_Report>/;
		      let rBalRegex	= /<CreditSummaryDetail><Type>R<\/Type>.*?<Balance>0*(\d+|0)<\/Balance>.*?<\/CreditSummaryDetail>/;
          let iPayRegex	= /<CreditSummaryDetail><Type>I<\/Type>.*?<MonthlyPayment>0*(\d+|0)<\/MonthlyPayment>.*?<\/CreditSummaryDetail>/;
          
          // Fill the update object with data
          upObj.score		= scoreRegex.exec(xml);
          upObj.score		= upObj.score ? upObj.score[1] : '-2';
          let summary		= sumRegex.exec(xml);
          upObj.creditSum	= {
            highCredit:		summary ? summary[1] : '-1',
            creditLimit:	summary ? summary[2] : '-1',
            balance:		summary ? summary[3] : '-1',
            pastDue:		summary ? summary[4] : '-1',
            monthlyPayment:	summary ? summary[5] : '-1'
          }
          upObj.rBalance = rBalRegex.exec(xml);
          upObj.rBalance = upObj.rBalance[1] ? upObj.rBalance[1] : '-1';
          upObj.iPayment = iPayRegex.exec(xml);
          upObj.iPayment = upObj.iPayment[1] ? upObj.iPayment[1] : '-1';
          creditDebt = parseFloat(upObj.rBalance);
          iPay = parseFloat(upObj.iPayment);

          // Upload txt report to FB storage
          let report	= reportRegex.exec(xml);
          report		= report ? report[1] : 'NOT FOUND! XML:\n' + xml;
          let file	= 'TU_Reports/' + client.fname + '-' + client.lname + '_' + new Date().toISOString() + '.txt';
          admin.storage().bucket().file(file.replace(/-/g, '-')).save(report, { gzip: false, contentType: 'text/plain' }).then();

        } else {
          upObj.score = "-1";
        }

        return admin.database().ref(`applicants/${request.body.key}/score`).set(upObj).then(() => {
          if (joint) {
            let secondaryClient;
            webhookURL = 'https://flow.zoho.com/685427162/flow/webhook/incoming?zapikey=1001.3738de624a9c2434827ad9c06f11df6d.470bff4b6de5a54727fa275d5bc71641&isdebug=false';
            if (!sameAdd) {
              secondaryClient = { fname: object.secondaryApplicantFirstName, lname: object.secondaryApplicantLastName, address: object.primaryAddress, dob: object.secondaryApplicantDOB, province: object.primaryProvince, city: object.primaryCity, postal: object.primaryPostal }
            } else {
              if (object.coAppApt) {
                secondaryClient = { fname: object.secondaryApplicantFirstName, lname: object.secondaryApplicantLastName, address: object.coAppAddress, dob: object.secondaryApplicantDOB, province: object.coAppProvince, city: object.coAppCity, postal: object.coAppPostal, apt: object.coAppApt }
              } else {
                secondaryClient = { fname: object.secondaryApplicantFirstName, lname: object.secondaryApplicantLastName, address: object.coAppAddress, dob: object.secondaryApplicantDOB, province: object.coAppProvince, city: object.coAppCity, postal: object.coAppPostal }
              }
            }
            let upObjCoApp	= {};
            tuxml.getRecord(secondaryClient, membercode, pass, url).then((data) => {
            if (data.type === 'SUCCESS') {
              let xml		= data.response;
              let scoreRegex	= /<Score>([0-9]*)<\/Score>/;
              let sumRegex	= /<CreditSummaryDetail><Type>T<\/Type><HighCredit>0*([0-9]+|0)<\/HighCredit><CreditLimit>0*([0-9]+|0)<\/CreditLimit><Balance>0*([0-9]+|0)<\/Balance><PastDue>0*([0-9]+|0)<\/PastDue><MonthlyPayment>0*([0-9]+|0)<\/MonthlyPayment><\/CreditSummaryDetail>/;
              let reportRegex	= /<TU_TTY_Report><\!\[CDATA\[((?:.|\n|\r)*?)\]\]><\/TU_TTY_Report>/;
              let rBalRegex	= /<CreditSummaryDetail><Type>R<\/Type>.*?<Balance>0*(\d+|0)<\/Balance>.*?<\/CreditSummaryDetail>/;
              let iPayRegex	= /<CreditSummaryDetail><Type>I<\/Type>.*?<MonthlyPayment>0*(\d+|0)<\/MonthlyPayment>.*?<\/CreditSummaryDetail>/;
              
              // Fill the update object with data
              upObjCoApp.score		= scoreRegex.exec(xml);

              upObjCoApp.score		= upObjCoApp.score ? upObjCoApp.score[1] : '-2';
              let summary		= sumRegex.exec(xml);
              upObjCoApp.creditSum	= {
                highCredit:		summary ? summary[1] : '-1',
                creditLimit:	summary ? summary[2] : '-1',
                balance:		summary ? summary[3] : '-1',
                pastDue:		summary ? summary[4] : '-1',
                monthlyPayment:	summary ? summary[5] : '-1'
              }
              upObjCoApp.rBalance = rBalRegex.exec(xml);
              upObjCoApp.rBalance = upObj.rBalance[1] ? upObj.rBalance[1] : '-1';
              upObjCoApp.iPayment = iPayRegex.exec(xml);
              upObjCoApp.iPayment = upObjCoApp.iPayment[1] ? upObjCoApp.iPayment[1] : '-1';
              creditDebtCoApp = parseFloat(upObjCoApp.rBalance);
              iPayCoApp = parseFloat(upObjCoApp.iPayment);

              // Upload txt report to FB storage
              let report	= reportRegex.exec(xml);
              report		= report ? report[1] : 'NOT FOUND! XML:\n' + xml;
              let file	= 'TU_Reports/' + secondaryClient.fname + '-' + secondaryClient.lname + '_' + new Date().toISOString() + '.txt';
              admin.storage().bucket().file(file.replace(/-/g, '-')).save(report, { gzip: false, contentType: 'text/plain' }).then();
            } else {
              upObjCoApp.score = "-1";
            }
            if (locBalance) {
              if ((creditDebt > locBalance) && (creditDebtCoApp > locBalance)) {
                monthlyDebt = (iPay + ((creditDebt - locBalance) * 0.03)) + ((iPayCoApp + ((creditDebtCoApp - locBalance) * 0.03))* 0.60);
              }
              else if ((creditDebt < locBalance) && (creditDebtCoApp < locBalance)) {
                monthlyDebt = (iPay + iPayCoApp + ((creditDebt + creditDebtCoApp) * 0.03));
              }
              else {
                monthlyDebt = (((creditDebt + (creditDebtCoApp * 0.60)) - locBalance) * 0.03) + iPay + (iPayCoApp * 0.60);
              }
              newParentData.monthlyDebtCoApp = iPayCoApp;
              newParentData.creditDebtCoApp = creditDebtCoApp;
              newParentData.monthlyDebt = iPay;
              newParentData.creditDebt = creditDebt;
              newCalculations.TDS = (((parseFloat(object.calculations.condoFees) + parseFloat(object.calculations.propertyTax) + parseFloat(object.calculations.mortgagePayment) + parseFloat(object.calculations.utilities) + monthlyDebt) / parseFloat(object.calculations.totalMonthlyIncome)) * 100).toFixed(2);
              newCalculations.monthlyDebt = monthlyDebt;
            }
            return admin.database().ref(`applicants/${request.body.key}/calculations`).update(newCalculations).then(() => {
              return admin.database().ref(`applicants/${request.body.key}`).update(newParentData).then(() => {
                return admin.database().ref(`applicants/${request.body.key}/scoreCoApp`).set(upObjCoApp).then(() => {
                  return admin.database().ref(`applicants/${request.body.key}`).once('value').then((data) => {
                  let payload = data.val();
                  payload.secondaryApplicantDOB = data.val().secondaryApplicantDOB.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                  if (payload.fnceObj === 'Offer of Purchase') {
                    payload.oopDate = data.val().oopDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                    payload.fnceCompDate = data.val().fnceCompDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                    payload.possessionDate = data.val().possessionDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                  }
                  payload.primaryDOB = data.val().primaryDOB.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                  superagent.post(webhookURL).set('Content-Type', 'application/json').send(payload).then(res => {
                    response.send(res);
                  }, err => {
                    let smsMessage = new api.SmsMessage();
                    smsMessage.source = 'sdk';
                    smsMessage.from = functions.config().clicksend.number;
                    smsMessage.to = '+14036087447';
                    smsMessage.body = `There has been an error with the Zoho Webhook! All data was compiled correctly but the webhook failed.`;
          
                    let smsCollection = new api.SmsMessageCollection();
                    smsCollection.messages = [smsMessage];
                    smsApi.smsSendPost(smsCollection).then(() => {
                      response.send(err);
                    });
                  });
                });
              });
            });
          });
        });
        } else {
          if (locBalance) {
            if (creditDebt > locBalance) {
              monthlyDebt = (iPay + ((creditDebt - locBalance) * 0.03));
            }
            else if (creditDebt < locBalance) {
              monthlyDebt = (iPay + (creditDebt * 0.03));
            }
            else {
              monthlyDebt = (iPay + ((creditDebt - locBalance) * 0.03));
            }
            newParentData.monthlyDebt = iPay;
            newParentData.creditDebt = creditDebt;
            newCalculations.TDS = (((parseFloat(object.calculations.condoFees) + parseFloat(object.calculations.propertyTax) + parseFloat(object.calculations.mortgagePayment) + parseFloat(object.calculations.utilities) + monthlyDebt) / parseFloat(object.calculations.totalMonthlyIncome)) * 100).toFixed(2);
            newCalculations.monthlyDebt = monthlyDebt;
          }
          return admin.database().ref(`applicants/${request.body.key}/calculations`).update(newCalculations).then(() => {
            return admin.database().ref(`applicants/${request.body.key}`).update(newParentData).then(() => {
              admin.database().ref(`applicants/${request.body.key}`).once('value').then((data) => {
                let payload = data.val();
                if (payload.fnceObj === 'Offer of Purchase') {
                  payload.oopDate = data.val().oopDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                  payload.fnceCompDate = data.val().fnceCompDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                  payload.possessionDate = data.val().possessionDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                }
                payload.primaryDOB = data.val().primaryDOB.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
                superagent.post(webhookURL).set('Content-Type', 'application/json').send(payload).then(res => {
                  response.send(res);
                }, err => {
                  let smsMessage = new api.SmsMessage();
                  smsMessage.source = 'sdk';
                  smsMessage.from = functions.config().someservice.id;
                  smsMessage.to = '+14039230607';
                  smsMessage.body = `There has been an error with the Zoho Webhook! All data was compiled correctly but the webhook failed.`;
        
                  let smsCollection = new api.SmsMessageCollection();
                  smsCollection.messages = [smsMessage];
                  smsApi.smsSendPost(smsCollection).then(() => {
                    response.send(err);
                  });
                });
              });
            });
          });
          }
        });
      });
    });
  });
});

/**
 * Once new HomeHow Partner reads and signs the consent form, their
 * status will be updated to 'Activated', their signature will be stored 
 * in Firebase storage under their 'lastName_mobile number' and they
 * will be motified that they are offically signed up.
 */
exports.partnershipConsent = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`partners/${request.body.key}`).once('value').then((data) => {
      return admin.database().ref(`partners/${request.body.key}`).update({ status: 'Activated' }).then(() => {

        let base64EncodedImageString = request.body.image.split(',')[1],
        mimeType = 'image/jpeg',
        fileName = `${data.val().lastName}_${data.val().mobile}`,
        imageBuffer = new Buffer(base64EncodedImageString, 'base64');
        let bucket = admin.storage().bucket();
        let file = bucket.file(`partner_signatures/` + fileName);
        file.save(imageBuffer, {
          metadata: { contentType: mimeType },
        });

        let smsMessage = new api.SmsMessage();

        smsMessage.source = 'sdk';
        smsMessage.from = functions.config().clicksend.number;
        smsMessage.to = '4036087447';
        smsMessage.body = data.val().firstName + ' ' + data.val().lastName + ' has signed the BigBPS Partnership Agreement and is now an activated partner';
        let smsCollection = new api.SmsMessageCollection();
        smsCollection.messages = [smsMessage];
        smsApi.smsSendPost(smsCollection).then(() => {

          smsMessage.source = 'sdk';
          smsMessage.from = functions.config().clicksend.number;
          smsMessage.to = data.val().mobile;
          smsMessage.body = `It’s official! You’re now a BigBPS Referral Partner! Here are some commands that will help you get started. Type 1 for Mortgage Client Referral. Type 2 for Client Status or Type 3 for My Points. Feel free to text 1-833-466-3469 for any questions or concerns. `; 
          let smsCollection = new api.SmsMessageCollection();
          smsCollection.messages = [smsMessage];
          smsApi.smsSendPost(smsCollection);
          response.send(request.body);
          
        }).catch((err) => {
          response.send(err);
        });
      });
    });
  });
});

/** 
 * Signs up partner and sends confirmation message to partner to confirm that
 * they have signed up. Also sends message to Chris Cabel informing him of
 * the partner signing up.
 */
exports.signUp = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.mobileNumber).once('value').then(snapshot => {
      if (!snapshot.val()) {
        return admin.database().ref(`partners`).push({ firstName: request.body.formData.firstName, lastName: request.body.formData.lastName, mobile: request.body.mobileNumber, email: request.body.formData.email, status: 'Pending', flag: request.body.formData.flag[0], company: request.body.formData.company, refferedBy: request.body.formData.associate[0] }).then(() => {

          let smsMessage = new api.SmsMessage();

          smsMessage.source = 'sdk';
          smsMessage.from = functions.config().clicksend.number;
          smsMessage.to = functions.config().clicksend.approvalnum;
          smsMessage.body = 'Approve ' + request.body.mobileNumber;

          let webhook = 'https://flow.zoho.com/685427162/flow/webhook/incoming?zapikey=1001.84d8094b48454dcd8573ba8173299fce.f1435d45325c37f66a25e647343b4f60&isdebug=false'
          superagent.post(webhook).set('Content-Type', 'application/json').send(request.body).then(() => {
          }, err => {
            console.error(err);
          });

          let smsCollection = new api.SmsMessageCollection();
          smsCollection.messages = [smsMessage];
          smsApi.smsSendPost(smsCollection).then(() => {
      
            smsMessage.source = 'sdk';
            smsMessage.from = functions.config().clicksend.number;
            smsMessage.to = request.body.mobileNumber;
            smsMessage.body = 'Thank you for taking the time to become BigBPS\'s partner. We will contact you within the next business day.'

            let smsCollection = new api.SmsMessageCollection();
            smsCollection.messages = [smsMessage];
            smsApi.smsSendPost(smsCollection).then(response.send(request.body));

          });
        }).catch((err) => {
          response.send(err);
        });
      } else {
        response.send(err);
      }
    });
  });
});

exports.signUpAuto = functions.https.onRequest((request, response) => {
  let smsMessage = new api.SmsMessage();
  return cors(request, response, () => {
    return admin.database().ref(`partners`).push({ firstName: request.body.formData.firstName, mobile: request.body.formData.mobile, refferedBy: request.body.rvpAgent, status: 'Activated' }).then((data) => {
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = '+1' + request.body.formData.mobile;
      smsMessage.body = `${functions.config().clicksend.url}/quickApp?id=${data.key}&name=${request.body.formData.firstName}`

      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      return smsApi.smsSendPost(smsCollection).then((response) => {
        response.send(request.body);
      }).catch((err) => {
        response.send(err);
      });
    });
  });
});

exports.finishSignUp = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`partners/${request.body.key}`).update({ lastName: request.body.formData.lastName, email: request.body.formData.email, flag: request.body.formData.flag[0], company: request.body.formData.company }).then(() => {
      response.send(request.body);
    });
  });
});

/**
 * Checks the status of the partner to see if they have been approved.
 */
exports.checkStatus = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`partners/${request.body.id}`).once('value').then((data) => {
      response.send({data: data.val()});
    }).catch((err) => {
      response.send(err);
    });
  });
});

/**
 * Submits a new client to database and uploads their signature to 
 * Firebase Storage. Also does multiple calculations based on what
 * type of deal is being submitted and pushes those to the database
 * as well.
 */
exports.submitClient = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    let utilities = 250;
    let condoFees = (/apartment|town/.test(request.body.formData.propType.toLowerCase()) ? 250 : 0);
    let qualifyingRate = (/refinance|renewal/.test(request.body.formData.fnceObj.toLowerCase()) ? 0.0479 : 0.0519);
    let purchaseValue;
    let LTV;
    let borrowingAmount;
    let amountRequested;
    let premium;
    let insurance;
    let monthlyDebt;
    let monthlyIncome;
    let monthlyIncomeCoApp;
    let downBudget;
    if (/refinance|renewal/.test(request.body.formData.fnceObj.toLowerCase())) {
      purchaseValue = parseFloat(request.body.formData.marketPrice.replace(/\D/g,''));
      let mortgageBalance = request.body.formData.mortgageBalance ? parseFloat(request.body.formData.mortgageBalance.replace(/\D/g,'')) : 0;
      let locBalance =  request.body.formData.locBalance ? parseFloat(request.body.formData.locBalance.replace(/\D/g,'')) : 0;
      LTV = ((locBalance + mortgageBalance + parseFloat(request.body.formData.equity.replace(/\D/g,''))) / purchaseValue) * 100;
      borrowingAmount = locBalance + mortgageBalance + parseFloat(request.body.formData.equity.replace(/\D/g,''));
      amountRequested = borrowingAmount;
    } else if (/offer/.test(request.body.formData.fnceObj.toLowerCase())) {
      downBudget = parseFloat(request.body.formData.downPayment.replace(/\D/g,''));
      purchaseValue = parseFloat(request.body.formData.purchaseValue.replace(/\D/g,''));
      LTV = ((purchaseValue - parseFloat(request.body.formData.downPayment.replace(/\D/g,''))) / purchaseValue) * 100;
      borrowingAmount = purchaseValue - parseFloat(request.body.formData.downPayment.replace(/\D/g,''));
      if (purchaseValue < 1000000 && LTV > 80) {
        let premiumRange = parseFloat(request.body.formData.downPayment.replace(/\D/g,'') / purchaseValue) * 100;
        if (premiumRange >= 0 && premiumRange < 5) {
          premium = 0;
        }
        else if (premiumRange >= 5 && premiumRange < 10) {
          premium = 0.04;
        }
        else if (premiumRange >= 10 && premiumRange < 15) {
          premium = 0.031;
        }
        else if (premiumRange >= 15 && premiumRange < 20) {
          premium = 0.028;
        }
        else if (premiumRange >= 20) {
          premium = 0;
        }
        insurance = borrowingAmount * premium;
        amountRequested = borrowingAmount + insurance;
      } else {
        amountRequested = borrowingAmount;
      }
    } else {
      downBudget = parseFloat(request.body.formData.downBudget.replace(/\D/g,''));
      purchaseValue = parseFloat(request.body.formData.homeBudget.replace(/\D/g,''));
      LTV = ((purchaseValue - parseFloat(request.body.formData.downBudget.replace(/\D/g,''))) / purchaseValue) * 100;
      borrowingAmount = purchaseValue - parseFloat(request.body.formData.downBudget.replace(/\D/g,''));
      if (purchaseValue < 1000000 && LTV > 80) {
        let premiumRange = (request.body.formData.downBudget.replace(/\D/g,'') / purchaseValue) * 100;
        if (premiumRange >= 0 && premiumRange < 5) {
          premium = 0;
        }
        else if (premiumRange >= 5 && premiumRange < 10) {
          premium = 0.04;
        }
        else if (premiumRange >= 10 && premiumRange < 15) {
          premium = 0.031;
        }
        else if (premiumRange >= 15 && premiumRange < 20) {
          premium = 0.028;
        }
        else if (premiumRange >= 20) {
          premium = 0;
        }
        insurance = borrowingAmount * premium;
        amountRequested = borrowingAmount + insurance;
      } else {
        amountRequested = borrowingAmount;
      }
    }
    
    /*
    if (!request.body.formData.creditDebtCoApp) {
      monthlyDebt = (parseFloat(request.body.formData.creditDebt.replace(/\D/g,'')) * 0.03) + parseFloat(request.body.formData.monthlyDebt.replace(/\D/g,''));
    } else {
      monthlyDebt = (parseFloat(request.body.formData.creditDebt.replace(/\D/g,'')) * 0.03) + (parseFloat(request.body.formData.creditDebtCoApp.replace(/\D/g,'')) * 0.03) + parseFloat(request.body.formData.monthlyDebt.replace(/\D/g,'')) + parseFloat(request.body.formData.monthlyDebtCoApp.replace(/\D/g,''));
    }
    */

    let propertyTax = (parseFloat(purchaseValue) * 0.006353) / 12;
    
    if (request.body.formData.incomeSource === 'Employed') {
      if (request.body.formData.employedSource === 'Fixed salary') {
        monthlyIncome = (parseFloat(request.body.formData.grossEarnings.replace(/\D/g,'')) / 12)
      }
      else if (/full time hourly/.test(request.body.formData.employedSource.toLowerCase())) {
        monthlyIncome = ((37.5 * parseFloat(request.body.formData.hourlyRate) * 52) / 12);
      }
      else if (/part time hourly/.test(request.body.formData.employedSource.toLowerCase())) {
        monthlyIncome = ((parseFloat(request.body.formData.hoursPerWeek) * parseFloat(request.body.formData.hourlyRate) * 52) / 12);
      }
      else {
        monthlyIncome = parseFloat(request.body.formData.currentYearBase.replace(/\D/g,''));
      }
    } else if (request.body.formData.incomeSource === 'Self-employed') {
        monthlyIncome = (parseFloat(request.body.formData.currentYearSelf.replace(/\D/g,'')) / 12);
    } else {
      monthlyIncome = (parseFloat(request.body.formData.currentYear.replace(/\D/g,'')) / 12);
    }
    if (request.body.formData.incomeSourceCoApp) {
      if (request.body.formData.incomeSourceCoApp === 'Employed') {
        if (request.body.formData.employedSourceCoApp === 'Fixed salary') {
          monthlyIncomeCoApp = (parseFloat(request.body.formData.grossEarningsCoApp.replace(/\D/g,'')) / 12)
        }
        else if (/full time hourly/.test(request.body.formData.employedSourceCoApp.toLowerCase())) {
          monthlyIncomeCoApp = ((37.5 * parseFloat(request.body.formData.hourlyRateCoApp) * 52) / 12);
        }
        else if (/part time hourly/.test(request.body.formData.employedSourceCoApp.toLowerCase())) {
          monthlyIncomeCoApp = ((parseFloat(request.body.formData.hoursPerWeekCoApp) * parseFloat(request.body.formData.hourlyRateCoApp) * 52) / 12);
        }
        else {
          monthlyIncomeCoApp = parseFloat(request.body.formData.currentYearCoAppBase.replace(/\D/g,''));
        }
      } else if (request.body.formData.incomeSourceCoApp === 'Self-employed') {
        monthlyIncomeCoApp = (parseFloat(request.body.formData.currentYearCoAppSelf.replace(/\D/g,'')) / 12);
      } else {
        monthlyIncomeCoApp = (parseFloat(request.body.formData.currentYearCoApp.replace(/\D/g,'')) / 12);
      }
    }
    let totalMonthlyIncome = (monthlyIncomeCoApp) ? monthlyIncome + monthlyIncomeCoApp : monthlyIncome;
    if (totalMonthlyIncome === 0 || !totalMonthlyIncome) {
      totalMonthlyIncome = 100;
    }
    let power = Math.pow(1 + (qualifyingRate / 2), (1/6)) - 1;
    let pv = Math.pow(1 + power, 300);
    let mortgagePayment = power * amountRequested * (pv + 0) / (pv - 1);
    let GDS = ((condoFees + propertyTax + mortgagePayment + utilities) / totalMonthlyIncome) * 100;
    let displayBorrowingAmount = '$' + String(borrowingAmount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    let displayInsurance = insurance ? '$' + String(insurance.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')) : '0.00';
    let displayEquity = request.body.formData.equity ? '$' + String(parseFloat(request.body.formData.equity.replace(/\D/g,'')).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')) : '0.00';
    let displayAmountRequested = '$' + String(amountRequested.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    let displayDownBudget = downBudget ? '$' + String(downBudget.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')) : '0.00';
    let displayPurchaseValue = '$' + String(purchaseValue.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    let displayMortgagePayment = '$' + String(mortgagePayment.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
    return admin.database().ref(`applicants/${request.body.key}/calculations`).set({displayEquity: displayEquity.slice(0, -3), displayMortgagePayment: displayMortgagePayment.slice(0, -3), displayPurchaseValue: displayPurchaseValue.slice(0, -3), displayDownBudget: displayDownBudget.slice(0, -3), displayAmountRequested: displayAmountRequested.slice(0, -3), displayInsurance: displayInsurance.slice(0, -3), displayBorrowingAmount: displayBorrowingAmount.slice(0, -3), utilities: utilities, condoFees: condoFees, qualifyingRate: (qualifyingRate * 100).toFixed(2), purchaseValue: purchaseValue, LTV: LTV.toFixed(2), borrowingAmount: borrowingAmount, amountRequested: amountRequested, propertyTax: propertyTax, totalMonthlyIncome: totalMonthlyIncome.toFixed(0), mortgagePayment: mortgagePayment.toFixed(0), GDS: GDS.toFixed(2) }).then(() => {
      return admin.database().ref(`applicants/${request.body.key}`).update(request.body.formData).then((data) => {
        return admin.database().ref(`applicants/${request.body.key}`).once('value').then((client) => {

          if (request.body.formData.referral === "No") {
            let base64EncodedImageString = request.body.image.split(',')[1],
            mimeType = 'image/jpeg',
            fileName = `${client.val().primaryApplicantFirstName}_${client.val().primaryApplicantLastName}`,
            imageBuffer = new Buffer(base64EncodedImageString, 'base64');
            let bucket = admin.storage().bucket();
            let file = bucket.file(`client_signatures/${client.val().primaryApplicantLastName}_${client.val().primaryApplicantMobile}/` + fileName);
            file.save(imageBuffer, {
                metadata: { contentType: mimeType },
            });
          } else {
            let bucket = admin.storage().bucket();
            let base64EncodedImageString = request.body.image.split(',')[1],
            mimeType = 'image/jpeg',
            fileName = `${client.val().primaryApplicantFirstName}_${client.val().primaryApplicantLastName}`,
            imageBuffer = new Buffer(base64EncodedImageString, 'base64');
            let file = bucket.file(`client_signatures/${client.val().primaryApplicantLastName}_${client.val().primaryApplicantMobile}/` + fileName);
            file.save(imageBuffer, {
                metadata: { contentType: mimeType },
            });

            let base64EncodedImageStringCoApp = request.body.secondaryImage.split(',')[1],
            fileNameCoApp = `${client.val().secondaryApplicantFirstName}_${client.val().secondaryApplicantLastName}`,
            imageBufferCoApp = new Buffer(base64EncodedImageStringCoApp, 'base64');
            let fileCoApp = bucket.file(`client_signatures/${client.val().primaryApplicantLastName}_${client.val().primaryApplicantMobile}/` + fileNameCoApp);
            fileCoApp.save(imageBufferCoApp, {
                metadata: { contentType: mimeType },
            });
          }
          response.send({data});
        }).catch((error) => {
          let smsMessage = new api.SmsMessage();
          smsMessage.source = 'sdk';
          smsMessage.from = functions.config().clicksend.number;
          smsMessage.to = '+14036087447';
          smsMessage.body = `There has been an error pushing the client to the database! Please check Firebase logs for detailed error information.`;

          let smsCollection = new api.SmsMessageCollection();
          smsCollection.messages = [smsMessage];
          smsApi.smsSendPost(smsCollection).then(() => {
            response.send(error);
          });
        });
      });
    });
  });
});

/**
 * Checks the status of the partner to see if they have been approved.
 */
exports.getApplicant = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`applicants/${request.body.id}`).once('value').then((data) => {
      response.send({data: data.val()});
    }).catch((err) => {
      response.send(err);
    });
  });
});

/**
 * Registers a client and sends them a link to finish the referral form. If the
 * person texting is a Realtor then it sends them the Preapproval form, and if not
 * sends them the full Referral form.
 */
exports.registerApplicants = functions.https.onRequest((request, response) => {
  
  let smsMessage = new api.SmsMessage();
  let body = '';

  return cors(request, response, () => {
    return admin.database().ref(`applicants`).push({ primaryApplicantMobile: request.body.formData.primaryApplicantMobile, agentCode: request.body.agentCode, RVP: request.body.RVP, agentName: request.body.agentName }).then((data) => {
      if (request.body.flag === 'Realtor') {
        body = `${functions.config().clicksend.url}/preapproval?id=${data.key}&name=${request.body.formData.greetingName.trim()}`;
      } else {
        body = `Hi ${request.body.formData.greetingName.trim()},\n\nYou are receiving this message because ${request.body.agentName} has referred you to the instant mortgage approval by BigBPS Mortgage.\n\nPlease text STOP if you no longer wish to communicate with BigBPS Mortgage anytime. Start your instant pre-approval process now.\n\nPlease click here to continue: ${functions.config().clicksend.url}/applicant?id=${data.key}&name=${request.body.formData.greetingName.trim()}.`;
      }
      response.send(request.body);
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = request.body.formData.primaryApplicantMobile;
      smsMessage.body = body;

      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      smsApi.smsSendPost(smsCollection).then((response) => {
        response.send(request.body);
      }).catch((err) => {
        response.send(err);
      });
    });
  });
});

exports.consentRequest = functions.https.onRequest((request, response) => {
  
  let smsMessage = new api.SmsMessage();
  let intro = '';
  let url = '';
  let items = request.body.items;
  let sms = request.body.items[8].values.find(sms => sms.value === 'SMS');

  if (sms) {
    if (request.body.items[3].value) { 
      url = encodeURI(`https://fs4.formsite.com/QrLhXC/clientconsent/fill?id4=${items[0].value}&id5=${items[1].value}&id6=${items[5].value}&id8=${items[3].value}&id9=${items[4].value}&id26=${items[12].value}+%20+${items[13].value}+%20+${items[14].value}+%20+${items[15].value}+%20+${items[10].value}&id29=${items[18].value}+%20+${items[19].value}+%20+${items[20].value}+%20+${items[21].value}+%20+${items[22].value}&id28=${items[10].value}&id30=${items[11].value}`); 
      intro = `Hi ${items[0].value.trim()} & ${items[3].value.trim()}! ` 
    } else {
      url = encodeURI(`https://fs4.formsite.com/QrLhXC/clientconsent/fill?id4=${items[0].value}&id5=${items[1].value}&id6=${items[5].value}&id26=${items[12].value}+%20+${items[13].value}+%20+${items[14].value}+%20+${items[15].value}+%20+${items[10].value}`); 
      intro = `Hi ${items[0].value.trim()}! `
    }

    return isgd.shorten(url, function(res) {
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = '+1' + request.body.items[6].value;
      smsMessage.body = intro +  `Thank you for the opportunity for BigBPS Mortgage to serve your needs. Please click ${res} to provide consent for authorizing us to inquire your credit and manage your confidential information to proceed. We look forward to talking to you soon!`
      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      smsApi.smsSendPost(smsCollection).then((response) => {
        response.send(request.body);
      }).catch((err) => {
        response.send(err);
      });
    });
  } else {
    response.send(request.body);
  }
});

/**
 * Takes in values from the Prequal form and sends them a text with
 * the calculations done here.
 */
exports.registerLead = functions.https.onRequest((request, response) => {

  let smsMessage = new api.SmsMessage();

  return cors(request, response, () => {
    let minimumDown = ((request.body.formData.maximum / 0.95) - request.body.formData.maximum).toFixed(2);
    let maxiumumQual = (request.body.formData.income * 4);
    response.send(request.body);
    smsMessage.source = 'sdk';
    smsMessage.from = functions.config().clicksend.number;
    smsMessage.to = request.body.mobileNumber;
    smsMessage.body = `Congratulations, you are now qualified for a mortgage with a maxiumum amount of $${maxiumumQual}. You will need a minimum down payment of $${minimumDown}. If you would like to schedule a call please navigate to https://go.oncehub.com/ChrisCabel1. If not, type 'Call Me' and we will be in touch within the next 24 business hours `;

    let smsCollection = new api.SmsMessageCollection();
    smsCollection.messages = [smsMessage];
    return smsApi.smsSendPost(smsCollection).then((response) => {
      response.send(request.body);
    }).catch((err) => {
      response.send(err);
    });
  });
});

exports.getRates = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`rates`).once('value').then((data) => {
      response.send({data: data.val()});
    }).catch((err) => {
      response.send(err);
    });
  });
});

exports.getAllPartners = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`partners`).once('value').then((data) => {
      response.send({data: data.val()});
    }).catch((err) => {
      response.send(err);
    });
  });
});

exports.getAllDeals = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    return admin.database().ref(`applicants`).once('value').then((data) => {
      response.send({data: data.val()});
    }).catch((err) => {
      response.send(err);
    });
  });
});

exports.editRates = functions.https.onRequest((request, response) => {
  return cors(request, response, () => {
    if (request.body.type === 'editRefi') {
      return admin.database().ref(`rates`).update({ refinance: request.body.rate }).then(() => {
        return admin.database().ref(`applicants`).orderByChild('fnceObj').equalTo('Refinance / Renewal / Equity-Take-Out').on("value", function(snapshot) {
          Object.keys(snapshot.val()).map(function(key, index) {
            let power = Math.pow(1 + (parseFloat(request.body.rate) / 2), (1/6)) - 1;
            let pv = Math.pow(1 + power, 300);
            let mortgagePayment = power * snapshot.val()[key].calculations.amountRequested * (pv + 0) / (pv - 1);
            let GDS = ((snapshot.val()[key].calculations.condoFees + snapshot.val()[key].calculations.propertyTax + mortgagePayment + snapshot.val()[key].calculations.utilities) / snapshot.val()[key].calculations.totalMonthlyIncome) * 100;
            let TDS = ((snapshot.val()[key].calculations.condoFees + snapshot.val()[key].calculations.propertyTax + mortgagePayment + snapshot.val()[key].calculations.utilities + snapshot.val()[key].calculations.monthlyDebt) / snapshot.val()[key].calculations.totalMonthlyIncome) * 100;
            let displayMortgagePayment = '$' + String(mortgagePayment.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,'));
            admin.database().ref(`applicants/${key}/calculations`).update({ displayMortgagePayment: displayMortgagePayment.slice(0, -3), mortgagePayment: mortgagePayment.toFixed(0), GDS: GDS.toFixed(2), TDS: TDS.toFixed(2) });
          }).then(response.send(request.body));
        });
      }).catch((err) => {
        response.send(err);
      });
    } else {
      return admin.database().ref(`rates`).update({ purchase: request.body.rate }).then((data) => {
        response.send(data);
      }).catch((err) => {
        response.send(err);
      });
    }
  });
});

/**
 * Main function that handles what happens when a user sends 
 * the HomeHow number a command.
 */
exports.viewSMS = functions.https.onRequest((request, response) => {
  let smsMessage = new api.SmsMessage();
  let body = '';
  if (request.body.body.toLowerCase() === 'referral' || request.body.body.toLowerCase().replace(/[-\s]/g, '') === 'preapproval' || request.body.body === '1') {
    admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.sms.substring(2)).once('value').then(snapshot => {
      if (snapshot.val()) {
        body = `${functions.config().clicksend.url}/referral?id=${Object.keys(snapshot.val())[0]}`;
      } else {
        body = `${functions.config().clicksend.url}/sign-up?id=${request.body.sms.substring(2)}`;
      }
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = request.body.sms;
      smsMessage.body = body;
      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      return cors(request, response, () => {
        smsApi.smsSendPost(smsCollection).then((response) => {
          response.send(request.body);
        }).catch((err) => {
          response.send(err);
        });
      });
    });
  } 
  else if (request.body.body.toLowerCase().split(' ')[0] === 'approve') {
    return cors(request, response, () => {
      return admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.body.split(' ')[1]).once('value').then(snapshot => {
        return admin.database().ref(`partners/${Object.keys(snapshot.val())[0]}`).update({ status: 'Approved' }).then(() => {
          snapshot.forEach(childSnapshot => {
            if (childSnapshot.val().status === 'Approved') {
              let value = childSnapshot.val();
              smsMessage.source = 'sdk';
              smsMessage.from = functions.config().clicksend.number; 
              smsMessage.to = request.body.sms;
              smsMessage.body = value.firstName + ' ' + value.lastName + ' has been sent the BigBPS Partnership Agreement';
              let smsCollection = new api.SmsMessageCollection();
              smsCollection.messages = [smsMessage];
              smsApi.smsSendPost(smsCollection).then(() => {

                smsMessage.source = 'sdk';
                smsMessage.from = functions.config().clicksend.number;
                smsMessage.to = value.mobile;
                smsMessage.body = `Congratulations! You have been approved as a BigBPS Partner. Please navigate to the BigBPS Partnership Agreement which can be found here: ${functions.config().clicksend.url}/partnership?id=${Object.keys(snapshot.val())[0]}. After signing, you will be a partner.`;
                let smsCollection = new api.SmsMessageCollection();
                smsCollection.messages = [smsMessage];
                smsApi.smsSendPost(smsCollection);
                response.send(request.body);
              }).catch((err) => {
                response.send(err);
              });
            } else {
              response.send(request.body);
            }
          });
        });
      });
    });
  } 
  else if (request.body.body.toLowerCase().split(' ')[0] === 'reject') {
    return cors(request, response, () => {
      return admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.body.split(' ')[1]).once('value').then(snapshot => {
        return admin.database().ref(`partners/${Object.keys(snapshot.val())[0]}`).update({ status: 'Rejected'}).then(() => {
          snapshot.forEach(childSnapshot => {
            let value = childSnapshot.val();
            smsMessage.source = 'sdk';
            smsMessage.from = functions.config().clicksend.number;
            smsMessage.to = request.body.sms;
            smsMessage.body = value.firstName + ' ' + value.lastName + ' has been rejected';
            let smsCollection = new api.SmsMessageCollection();
            smsCollection.messages = [smsMessage];
            smsApi.smsSendPost(smsCollection).then(() => {

              smsMessage.source = 'sdk';
              smsMessage.from = functions.config().clicksend.number;
              smsMessage.to = value.mobile;
              smsMessage.body = `We require more information from you in order to approve your partnership. Please contact BigBPS Mortgage at 1-833-466-3469.`;
              let smsCollection = new api.SmsMessageCollection();
              smsCollection.messages = [smsMessage];
              smsApi.smsSendPost(smsCollection);
              response.send(request.body);
            }).catch((err) => {
              response.send(err);
            });
          });
        });
      });
    });
  } 
  else if (request.body.body.toLowerCase() === 'my points' || request.body.body === '3') {
    return admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.sms.substring(2)).once('value').then(snapshot => {
      snapshot.forEach(childSnapshot => {
        if (childSnapshot.val().status === "Activated") {
          body = `Hi ${childSnapshot.val().firstName}, BigBPS has received your request. You will receive a report in your email soon. BigBPS is diligently working on an instant response on this request, stay tuned!`;
        } else {
          body = "We are in the process of reviewing your information. We will contact you when you’re approved. "
        }
        smsMessage.source = 'sdk';
        smsMessage.from = functions.config().clicksend.number;
        smsMessage.to = request.body.sms;
        smsMessage.body = body;

        let smsCollection = new api.SmsMessageCollection();
        smsCollection.messages = [smsMessage];
        return cors(request, response, () => {
          smsApi.smsSendPost(smsCollection).then((response) => {
            response.send(request.body);
          }).catch((err) => {
            response.send(err);
          });
        });
      });
    });
  }
  else if (request.body.body.toLowerCase().trim() === 'BigBPS') {
    let rvpPair = { 4039230607: 'Jason', 4036088048: 'Chris', 4036087447: 'Linda', 7809152554: 'Dan' };
    let rvpList = ['4039230607', '4036088048', '4036087447', '7809152554'];
    if (rvpList.includes(request.body.sms.substring(2))) {
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = request.body.sms;
      smsMessage.body = `${functions.config().clicksend.url}/rvp?id=${rvpPair[request.body.sms.substring(2)]}`;
      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      return cors(request, response, () => {
        smsApi.smsSendPost(smsCollection).then((response) => {
          response.send(request.body);
        }).catch((err) => {
          response.send(err);
        });
      });
    } else {
      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = request.body.sms;
      smsMessage.body = 'Here are some commands that may help you. Please enter 1 for Mortgage Client Referral, 2 for Client Status, and 3 for My Points. Message 1-833-466-3469 if you have other questions.';
      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      return cors(request, response, () => {
        smsApi.smsSendPost(smsCollection).then((response) => {
          response.send(request.body);
        }).catch((err) => {
          response.send(err);
        });
      });
    }
  } 
  else if (request.body.body.toLowerCase() === 'client status' || request.body.body === '2') {
    return admin.database().ref(`partners`).orderByChild('mobile').equalTo(request.body.sms.substring(2)).once('value').then(snapshot => {
      snapshot.forEach(childSnapshot => {
        if (childSnapshot.val().status === "Activated") {
          body = `Hi ${childSnapshot.val().firstName}, BigBPS has received your request. You will receive a report in your email soon. BigBPS is diligently working on an instant response on this request, stay tuned!`;
        } else {
          body = "Looks like you don't have the permission to do that!"
        }
        smsMessage.source = 'sdk';
        smsMessage.from = functions.config().clicksend.number;
        smsMessage.to = request.body.sms;
        smsMessage.body = body;
        let smsCollection = new api.SmsMessageCollection();
        smsCollection.messages = [smsMessage];
        return cors(request, response, () => {
          smsApi.smsSendPost(smsCollection).then((response) => {
            response.send(request.body);
          }).catch((err) => {
            response.send(err);
          });
        });
      });
    });
  } else {
      if (request.body.body.toLowerCase().trim() === 'prequal') {
        body = `${functions.config().clicksend.url}/prequal?id=${request.body.sms}`;
      }
      else if (request.body.body.toLowerCase().trim() === 'help') {
        body = 'Please enter 1 for Mortgage Client Referral, 2 for Client Status, and 3 for My Points. Message 1-833-466-3469 if you have other questions.';
      }
      else if (request.body.body.toLowerCase().trim() === 'hello') {
        body = 'Hello! Please enter 1 for Mortgage Client Referral, 2 for Client Status, and 3 for My Points. Message 1-833-466-3469 if you have other questions.';
      }
      else {
        body = 'Here are some commands that may help you. Please enter 1 for Mortgage Client Referral, 2 for Client Status, and 3 for My Points. Message 1-833-466-3469 if you have other questions.'
      }

      smsMessage.source = 'sdk';
      smsMessage.from = functions.config().clicksend.number;
      smsMessage.to = request.body.sms;
      smsMessage.body = body;
      let smsCollection = new api.SmsMessageCollection();
      smsCollection.messages = [smsMessage];
      return cors(request, response, () => {
        smsApi.smsSendPost(smsCollection).then((response) => {
          response.send(request.body);
        }).catch((err) => {
          response.send(err);
        });
      });
    }

});