# Purpose of this document

This document contains known test data currently in the firestore database which can be used for testing purposes, I reccomend setting up saved postman commands in order to simplify your testing. 

Another note is that currently while testing you'll need to run /login to get a new authenticator token every 2 hours, because that is the expiry period of them. My current thoughts of avoiding having to do this is either to generate a token that lasts forever (huge securtiy risk in a real organisation but probably fine here), or to instead have some logic to recognise particular logins as test data and not require authentication, however this is much more work.

I will add one of these eventually.

# Test User

`ID`: EygYrT6U1XV4H3zjVM7Y
`email`: test@gmail.com
`password`: TestAccount123!
