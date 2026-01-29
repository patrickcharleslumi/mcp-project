/**
 * Complete JWT Bearer test matching Prismatic's exact implementation
 */

const { createSign } = require("crypto");
const { URLSearchParams } = require('url');

// Exact configuration from Prismatic
const config = {
  tokenUrl: "https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com/services/oauth2/token",
  consumerKey: "3MVG9HtWXcDGV.nFOt_CSw5uZtPIiTdwCwJ0f59ZIjx3SEStOP3R97tuLy5u7Ys3HR4.uF5VRyxoHENZDJ86i",
  username: "bkafumbata.e5501ac127c0@agentforce.com",
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDSqtrcpAk1OjOY
V0BPXDtWvuTsNEKdxOOhvIutpshbwslNrvf0OKL6GrzCe+aMXsYutBbEyzIUzB3p
Oeh7y7cazuWgP7oiz49Qx8txnvCcVXjtFJPzHagbXZq+gaknJw4cZbHo7BqnBpF6
IInBDIVzmcGZwCqRnTrZANg4qLm2RYAnB7SLgOB5y7We2wPitmFWkTOl+1uFIhSm
/yjGie7aE0pAFEqscjk5G6uifnzkaWhmuFuxcpivEed6Kf3ItzUFC/mBXZfWHS5O
lFd43ja84At9aTHpH2AC8yKdJrYzSnAJ0RUxLaXq9Q5iR/ZxVEUqZEstqAP669kA
JTVnl4AvAgMBAAECggEABYLIV60j9L7jL9u8csU8gF5Ay82wnm2Z0+wEPH8tskFB
XPN7LD9HtJf6y46FL0Gg/FfkA+vEn6xRtRnkMy26dP49Vr/EBUFvSwwuDhUfXd+T
L/gOOhJhCK6scuZXTiuA/JsS32oGLgSyPvvJB56en04liofSw3mcvqW2SWWYFaSt
EQI3GVoz83G6VCtV9r7EH+a6Lx3ifLipVoceR57ejsmX+PXg0bhmlh0buIBuLuJ2
gtIraxPq2wilnLoJ51DkGow3zc4liCHofAsY0Cvn0mry0xx/RlvWRY+x+T6iTeV4
ii61AG9qjSmKOS2PWIp1tVmL1hyYwxdSlUMMPK7KUQKBgQD1ZOZagt2akxTTBKdi
Sqomm++QlCCj2yvHGzXRrSDl3cdLXtpuwEHqoelGu//q2Q1dRxuZkH6VfouvKFRm
0kP4KdOYZdcvSmBNQp1FX4FVPinzSXaQf5FE/0BrNln1PTczACnnZM6Q+bsli2Xn
Atl1TU1pRSbxy0gdQtcTKt2BvwKBgQDbxbrmLD9+5XF91QLKY40CBvMwQzqeMDL4
MgyQnq01TZsywO2JlrWKnemKUIibDmx8FiDO6sXhlQ+I/YKJoM9kISWxx9pLgIfm
uFKxvqpW9OcR5cDZDIJjk41a7/JLEKv/m/y7GJKAS3ZpSKrZIxmW6IIC72ISaCvM
xlP9oGm9kQKBgQDUForI+4YQDMLYxpLsbt+0Ut2wtXWoaMrjYO8Y82sVgKK4z5g2
VFAkPB/kFKRRE5trXQPLq4jcJ+0OS+r2mxBHsc7BTnO22a911vcaeDrNs9aKAJpK
tRaW7Y19nBIP1QKaP6/337ZwsoY/IsXF7T6JFXCsZSoNnMYNFDHSzR94/QKBgD+u
Zd+4RpXQijg59tsKSZuiw+jiMiQQN1Svu/BT6kCdwjDMsofBwczuwPMxLsQvQ8QY
7VzHrpsVBDFfs+mJTU7oQ/HlxR1HmxmBo4SZiOY1hJctCdpaw5Vy9ey5xm114UDp
xCu6jQjb1O3g/pB4mTufF70d/D71LGvjtAaz6q/hAoGAdDKbeLl5++MqE3Z00YNz
sMhzUBvh1V1FuBVg1FWSuMTFN7EmnH3jynx6iJ3lgQfibi0RGbYBG4kUYfxleXIR
g3HFi/gDVegweYQ5jPSoi6/Thf7iB9Bl8GMjoE2Oi4jYms7UM/8UGSXWK6NKRuOj
tIPZOBxjSpIl/YRINtgF0gI=
-----END PRIVATE KEY-----`
};

/**
 * Create JWT Bearer token exactly like Prismatic does
 */
function createJwtBearerToken(clientId, username, privateKey, tokenUrl) {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientId,
    sub: username,
    aud: tokenUrl,
    exp: now + 300, // 5 minutes expiration
    iat: now,
  };

  console.log("📋 JWT Payload:");
  console.log(JSON.stringify(payload, null, 2));

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}

async function testJwtBearerFull() {
  console.log("🧪 Complete JWT Bearer Authentication Test");
  console.log("🎯 Matching Prismatic's exact implementation\n");

  console.log("📋 Configuration:");
  console.log(`   Token URL: ${config.tokenUrl}`);
  console.log(`   Consumer Key: ${config.consumerKey.substring(0, 20)}...`);
  console.log(`   Username: ${config.username}`);
  console.log(`   Private Key: ${config.privateKey.length} characters\n`);

  try {
    // Step 1: Create JWT Bearer token
    console.log("🔧 Step 1: Creating JWT Bearer Token...");
    const jwtToken = createJwtBearerToken(
      config.consumerKey,
      config.username,
      config.privateKey,
      config.tokenUrl
    );

    console.log("   ✅ JWT token created successfully!");
    console.log(`   Token preview: ${jwtToken.substring(0, 100)}...\n`);

    // Step 2: Make OAuth2 request
    console.log("🌐 Step 2: Making OAuth2 JWT Bearer request...");

    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
    }).toString();

    console.log("📤 Request details:");
    console.log(`   URL: ${config.tokenUrl}`);
    console.log(`   Grant Type: urn:ietf:params:oauth:grant-type:jwt-bearer`);
    console.log(`   Assertion (JWT): ${jwtToken.substring(0, 50)}...\n`);

    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const responseText = await response.text();
    console.log(`📥 Response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log("🎉 SUCCESS! JWT Bearer authentication working!");
      const data = JSON.parse(responseText);
      console.log(`   Access Token: ${data.access_token.substring(0, 30)}...`);
      console.log(`   Instance URL: ${data.instance_url}`);
      console.log(`   Token Type: ${data.token_type}`);

      // Test a simple SOQL query
      console.log("\n📊 Testing Salesforce API access...");
      const testQuery = "SELECT Id, Name FROM Opportunity LIMIT 1";
      const queryUrl = `${data.instance_url}/services/data/v58.0/query?q=${encodeURIComponent(testQuery)}`;

      const queryResponse = await fetch(queryUrl, {
        headers: {
          "Authorization": `Bearer ${data.access_token}`,
          "Accept": "application/json",
        },
      });

      if (queryResponse.ok) {
        const queryResult = await queryResponse.json();
        console.log("   ✅ SOQL query successful!");
        console.log(`   Records found: ${queryResult.totalSize}`);
        console.log("\n🎉 Complete JWT Bearer flow is working perfectly!");
        console.log("🔧 The issue must be in Prismatic's environment or configuration formatting.");
      } else {
        console.log("   ⚠️ Token works but SOQL query failed");
        const queryError = await queryResponse.text();
        console.log(`   Query error: ${queryError}`);
      }

      return true;

    } else {
      console.log("❌ JWT Bearer authentication failed!");
      console.log(`   Response: ${responseText}\n`);

      try {
        const errorData = JSON.parse(responseText);
        console.log("🔧 Error Analysis:");

        switch (errorData.error) {
          case "invalid_grant":
            console.log("   → Username is not authorized for this Connected App");
            console.log("   → Check Connected App > Manage > Edit Policies > Permitted Users");
            console.log("   → Verify user profile is allowed or set to 'All users may self-authorize'");
            break;
          case "invalid_client_id":
            console.log("   → Consumer Key is invalid or Connected App not found");
            break;
          case "unsupported_grant_type":
            console.log("   → JWT Bearer flow is not enabled in Connected App");
            break;
          case "invalid_request":
            console.log("   → JWT token format or claims are invalid");
            console.log("   → Check audience (aud) claim matches token URL");
            break;
          default:
            console.log(`   → Unknown error: ${errorData.error}`);
            console.log(`   → Description: ${errorData.error_description}`);
        }
      } catch (e) {
        console.log("   → Could not parse error response");
      }

      return false;
    }

  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
    return false;
  }
}

// Test different audience values
async function testAudienceVariations() {
  console.log("\n🔍 Testing different audience (aud) claim values...\n");

  const audienceUrls = [
    config.tokenUrl, // Current
    "https://login.salesforce.com",
    "https://test.salesforce.com",
    "https://orgfarm-e2bbca81d6-dev-ed.develop.my.salesforce.com"
  ];

  for (let i = 0; i < audienceUrls.length; i++) {
    const aud = audienceUrls[i];
    console.log(`🧪 Test ${i + 1}: Audience = ${aud}`);

    try {
      const testJwt = createJwtBearerToken(config.consumerKey, config.username, config.privateKey, aud);

      const body = new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: testJwt,
      }).toString();

      const response = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (response.ok) {
        console.log("   ✅ SUCCESS with this audience!");
        const data = await response.json();
        console.log(`   Token: ${data.access_token.substring(0, 30)}...`);
        return aud; // Return the working audience
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Failed: ${response.status}`);
        try {
          const errorData = JSON.parse(errorText);
          console.log(`   Error: ${errorData.error}`);
        } catch (e) {
          console.log(`   Raw: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log();
  }

  return null;
}

// Run the comprehensive test
testJwtBearerFull().then(success => {
  if (!success) {
    console.log("\n🔄 Trying audience variations...");
    testAudienceVariations().then(workingAud => {
      if (workingAud) {
        console.log(`\n✅ Working audience found: ${workingAud}`);
        console.log("🔧 Update your Prismatic JWT code to use this audience value.");
      } else {
        console.log("\n❌ No working audience found. Check Connected App user authorization.");
      }
    });
  }
});