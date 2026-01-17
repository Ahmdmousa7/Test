
// Handles Google OAuth 2.0 and Sheets API Write operations

declare var google: any;

let tokenClient: any = null;
let accessToken: string | null = null;

// Initialize the GIS Token Client
export const initGoogleAuth = (clientId: string, callback: (token: string) => void) => {
  if (typeof google === 'undefined') return;
  
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    callback: (tokenResponse: any) => {
      if (tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        callback(accessToken);
      }
    },
  });
};

export const requestGoogleToken = () => {
  if (!tokenClient) {
    throw new Error("Google Client ID not configured. Please add it in settings.");
  }
  // If we already have a token, we could check expiry, but for simplicity we request fresh if needed
  // or user triggers the flow.
  tokenClient.requestAccessToken();
};

/**
 * Writes data to a specific column range in Google Sheets.
 * NOTE: This assumes row 1 is header and writes data starting from row 2.
 */
export const updateSheetColumn = async (
  spreadsheetId: string, 
  sheetName: string, 
  colIndex: number, // 0-based
  values: string[]
): Promise<void> => {
  if (!accessToken) throw new Error("No Access Token. Please Connect Google Account.");

  // Convert 0-based index to A1 notation (e.g. 0 -> A, 1 -> B)
  const getColLetter = (c: number) => {
      let letter = '';
      c++; 
      while (c > 0) {
        let temp = (c - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        c = (c - temp - 1) / 26;
      }
      return letter;
  };

  const colLetter = getColLetter(colIndex);
  // Start from Row 2 to skip header, go to length + 1
  const range = `'${sheetName}'!${colLetter}2:${colLetter}${values.length + 1}`;
  
  // Format values for API: [[val1], [val2], ...]
  const body = {
    values: values.map(v => [v])
  };

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Google Sheets API Error: ${err.error.message}`);
  }
};