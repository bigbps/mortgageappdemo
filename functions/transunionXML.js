/* Imports ------------------------------------------------------------------ */

var superagent	= require('superagent'); 

/* Functions ---------------------------------------------------------------- */

/**
 * Tries to get the Trans Union credit report for a client.
 *
 * Params:
 *  - client (Object)		: A client object used to get the credit report.
 *								Must have firstName, lastName, dateOfBirth, civic,
 *								street, city, province (2 letters), and postalCode.
 *
 * Returns:
 *  - (Promise -> Object)	: An object containing the response of the request.
 */
function getRecord(client, membercode, password, url) {

	console.log(client);
  const civic = client.address.substr(0, client.address.indexOf(' '));
	const streetAdd = client.address.substr(client.address.indexOf(' ') + 1);
	console.log(membercode, password, url);
	let tuURL = url
	let environment;
	if (url === 'https://tu.tuconline.com/xml/r4.asp') {
		environment = 'Production'
	} else {
		environment = 'Test'
	}
	// Generate the input XML
	const xml	=
		'<?xml version="1.0"?>' +
		`<TUCANREL4><Route RouteDest="Canada" RouteType="${environment}"></Route>` +
			'<UserReference>TEST</UserReference>' +
			'<MemberCode>' + membercode + '</MemberCode>' +
			'<Password>' + password + '</Password>' +
			'<Product>07000</Product>' +
			'<TTY>' +
				'<FFR>Y</FFR>' +
				'<Language>English</Language>' +
			'</TTY>' +
			'<Subject>' +
				'<Name>' +
					'<FirstName>' + client.fname + '</FirstName>' +
					'<LastName>' + client.lname + '</LastName>' +
				'</Name>' +
				'<DOB>' + client.dob + '</DOB>' +
				'<Address>' +
					(client.apt ? ('<Apt>' + client.apt + '</Apt>') : '') +
					'<Civic>' + civic + '</Civic>' +
					'<Street>' + streetAdd + '</Street>' +
					'<Prov>' + client.province + '</Prov>' +
					'<City>' + client.city + '</City>' +
					'<Postal>' + client.postal.trim() + '</Postal>' +
				'</Address>' +
			'</Subject>' +
			'<OptionalRequest>' +
				'<ErrorText>B</ErrorText>' +
				'<Summary>Y</Summary>' +
			'</OptionalRequest>' +
		'</TUCANREL4>';
		console.log(xml);

	/**
	 * Sends the input XML to Trans Union, and gets the response.
	 *
	 * Resolves:
	 *  - (Object)	: A response object for the report.
	 */
	return new Promise( async (resolve, reject) => {

		// Connect to TU
		const res = await superagent
		// Go to the endpoint
		.post(tuURL)
		// Send the input XML
		.send(xml)
		// Set a timeout
		.timeout({
			response: 5000,
			deadline: 10000
		})
		// Set the content header
		.set('Content-Type', 'text/xml')
		// Catch any error
		.catch( err => {
			return {
				type:		'ERROR',
				code:		err.status,
				response:	err.response.text
			}
		});

		// Reject if an error was thrown, or if no match was found
		if (res.type === 'ERROR')
			reject(res);
		else if (/<Hit>N<\/Hit>/.test(res.text)) {
			reject({
				type:		'ERROR',
				response:	'No match found'
			});
		}

		// Resolve the response data
		resolve({
			type:		'SUCCESS',
			response:	res.text
		});

	});
}

/* Exports ---------------------------------------------------------------- */

const exp = {
	getRecord
};

module.exports = exp;