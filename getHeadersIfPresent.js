module.exports = function(pgnString) {

	var parts = pgnString.split('\n\n'); // Unix

	if (parts.length > 1) {
		// Possibly hit
		return getHeaders(parts[0]);
	}

	parts = pgnString.split('\r\n'); // Windows

	if (parts.length > 1) {
		// Possibly hit
		return getHeaders(parts[0]);
	}

	return null;
}

function getHeaders(headersString) {
	headersString = headersString.trim();

	if (headersString.charAt(0) === '[') {
		// Good enough, lets presume we have headers
		return headersString;
	}
	return null;
}