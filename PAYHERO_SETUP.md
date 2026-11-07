# PayHero M-PESA STK Push setup

The deposit form starts an M-PESA STK Push from the server. The browser never receives PayHero credentials. A wallet deposit is credited only after PayHero sends a successful callback that matches the pending reference, amount, and phone number.

## PayHero account values

1. In the PayHero dashboard, open **API Credentials** and copy the API username and password.
2. Open **Payment Channels → My Payment Channels** and copy the channel ID for the M-PESA collection channel you want to use.
3. Keep those values private. Do not put them in client-side code or commit them.

PayHero documents the request as `POST https://backend.payhero.co.ke/api/v2/payments`, authenticated with HTTP Basic Auth using the API username and password. The JSON body uses an integer `amount`, `phone_number`, integer `channel_id`, `provider: "m-pesa"`, `external_reference`, and `callback_url`.

Official references: [Initiate M-PESA STK Push](https://docs.payhero.co.ke/docs/post-initiate-mpesa-stk-push-request), [Authorization](https://docs.payhero.co.ke/docs/authorization), and [Payment Callback](https://docs.payhero.co.ke/docs/payment-callback).

## Environment variables

Set these in `.env.local` for local development and in **Vercel → Project → Settings → Environment Variables** for deployed environments:

```dotenv
PAYHERO_API_USERNAME=your_api_username
PAYHERO_API_PASSWORD=your_api_password
PAYHERO_CHANNEL_ID=123
PAYHERO_CALLBACK_SECRET=use-a-long-random-secret
APP_BASE_URL=https://example.com
```

`APP_BASE_URL` is the public origin only: include `https://`, the hostname, and any required port, but no route or trailing slash. For local testing use a public HTTPS tunnel URL, because PayHero cannot reach `localhost`.

## Callback URL

The app builds this callback URL for each STK Push and sends it in the request's `callback_url` field:

```text
https://example.com/api/payhero/callback?key=use-a-long-random-secret
```

Replace `example.com` with the deployed public domain and replace the example key with the exact `PAYHERO_CALLBACK_SECRET` value. The callback URL is passed per payment request; PayHero's documented STK Push flow does not require entering a separate static webhook URL in the merchant dashboard. If PayHero provides a callback URL field in an optional channel or integration configuration, use the same route and secret format.

The endpoint accepts PayHero's callback payload, including `response.ExternalReference`, `response.Amount`, `response.Phone`, `response.MpesaReceiptNumber`, `response.ResultCode`, `response.ResultDesc`, and `response.Status`. It only credits when `ResultCode` is `0`, `Status` is `Success`, and the callback agrees with the original deposit. Duplicate successful callbacks are safe to retry.

## Verify the integration

1. Configure the variables above and restart the local server, or redeploy after adding the Vercel variables.
2. Confirm the chosen channel is enabled for M-PESA collections and has adequate PayHero service-wallet funds.
3. Sign in, open **Deposit**, enter a whole KES amount of at least the configured minimum, and submit.
4. Approve the prompt on the matching M-PESA phone. Leave the wallet dialog open while it checks the pending reference.
5. Confirm the deposit changes to successful, the receipt is shown, and the real-wallet balance is credited once.

For local callback testing, expose the local app at a temporary public HTTPS address and set `APP_BASE_URL` to that address. Do not use a fake success response to test a live wallet credit. PayHero's developer documentation says new developer accounts may request test credits from PayHero support.
