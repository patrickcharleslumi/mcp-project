/**
 * Verify that certificate and private key are a matching pair
 */

const { createHash, createSign, createVerify } = require("crypto");
const fs = require("fs");

// Read the certificate and private key
const certificatePath = "/Users/patrick.charles/salesforce.crt";
const privateKeyContent = `-----BEGIN PRIVATE KEY-----
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
-----END PRIVATE KEY-----`;

async function verifyCertificateKeyMatch() {
  console.log("🔍 Verifying Certificate and Private Key Match...\n");

  try {
    // Read certificate
    const certificate = fs.readFileSync(certificatePath, "utf8");
    console.log("📋 Certificate Info:");
    console.log(`   Path: ${certificatePath}`);
    console.log(`   Length: ${certificate.length} characters`);
    console.log(`   Starts with: ${certificate.substring(0, 30)}...`);

    console.log("\n📋 Private Key Info:");
    console.log(`   Length: ${privateKeyContent.length} characters`);
    console.log(`   Starts with: ${privateKeyContent.substring(0, 30)}...`);

    // Test 1: Sign data with private key
    console.log("\n🔧 Test 1: Sign data with private key...");
    const testData = "test-data-for-verification";

    const signature = createSign("RSA-SHA256")
      .update(testData)
      .sign(privateKeyContent, "base64");

    console.log("   ✅ Private key can sign data");
    console.log(`   Signature: ${signature.substring(0, 50)}...`);

    // Test 2: Verify signature with certificate
    console.log("\n🔧 Test 2: Verify signature with certificate...");

    const isValid = createVerify("RSA-SHA256")
      .update(testData)
      .verify(certificate, signature, "base64");

    if (isValid) {
      console.log("   ✅ Certificate can verify private key signature");
      console.log("\n🎉 SUCCESS: Certificate and private key are a matching pair!");
      return true;
    } else {
      console.log("   ❌ Certificate CANNOT verify private key signature");
      console.log("\n💥 MISMATCH: Certificate and private key do NOT match!");
      console.log("\n🔧 Solutions:");
      console.log("   1. Regenerate both certificate and private key together");
      console.log("   2. Upload the correct certificate that matches this private key");
      console.log("   3. Use the private key that matches the uploaded certificate");
      return false;
    }

  } catch (error) {
    console.log(`   ❌ Verification failed: ${error.message}`);
    console.log("\n🔧 Possible Issues:");
    console.log("   1. Certificate file not found or corrupted");
    console.log("   2. Private key format invalid");
    console.log("   3. Certificate format invalid");
    return false;
  }
}

// Additional test: Extract public key information
function extractKeyInfo() {
  console.log("\n🔍 Additional Key Analysis:");

  try {
    const crypto = require("crypto");

    // Get private key object
    const privateKeyObj = crypto.createPrivateKey(privateKeyContent);
    const publicFromPrivate = crypto.createPublicKey(privateKeyObj);

    console.log("   ✅ Private key is cryptographically valid");
    console.log(`   Key type: ${privateKeyObj.asymmetricKeyType}`);
    console.log(`   Key size: ${privateKeyObj.asymmetricKeySize * 8} bits`);

  } catch (error) {
    console.log(`   ❌ Private key analysis failed: ${error.message}`);
  }
}

// Run the verification
verifyCertificateKeyMatch().then(isMatch => {
  extractKeyInfo();

  if (isMatch) {
    console.log("\n✅ Certificate and private key match - the issue is elsewhere");
    console.log("🔧 Next steps:");
    console.log("   1. Check Salesforce Connected App JWT Bearer settings");
    console.log("   2. Verify username is authorized for this app");
    console.log("   3. Check Prismatic private key formatting");
  } else {
    console.log("\n❌ Certificate and private key don't match - this is the problem!");
    console.log("🔧 Fix by generating a new matching pair:");
    console.log("   openssl genrsa -out private.key 2048");
    console.log("   openssl req -new -x509 -key private.key -out certificate.crt -days 365");
  }
});