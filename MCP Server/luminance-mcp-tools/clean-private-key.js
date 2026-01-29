/**
 * Clean private key for Prismatic (remove extra spaces and format properly)
 */

// Your validated private key (copy from validate-private-key.js)
const YOUR_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
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

// Clean the private key
function cleanPrivateKey(privateKey) {
  console.log("🧹 Cleaning Private Key for Prismatic...\n");

  // Remove extra spaces and normalize line endings
  const cleaned = privateKey
    .split('\n')
    .map(line => line.trim())  // Remove leading/trailing spaces from each line
    .filter(line => line !== '') // Remove empty lines
    .join('\n');

  console.log("📋 Cleaned Key Info:");
  console.log(`   Original length: ${privateKey.length}`);
  console.log(`   Cleaned length: ${cleaned.length}`);
  console.log(`   Original lines: ${privateKey.split('\n').length}`);
  console.log(`   Cleaned lines: ${cleaned.split('\n').length}`);

  return cleaned;
}

// Generate both formats for Prismatic
function generatePrismaticFormats(cleanKey) {
  console.log("\n🔧 Prismatic Configuration Formats:\n");

  console.log("FORMAT 1 - Multi-line (copy this EXACTLY):");
  console.log("═".repeat(50));
  console.log(cleanKey);
  console.log("═".repeat(50));

  console.log("\nFORMAT 2 - Single line with \\n (alternative):");
  console.log("═".repeat(50));
  const singleLine = cleanKey.replace(/\n/g, '\\n');
  console.log(singleLine);
  console.log("═".repeat(50));

  console.log("\n📝 Instructions:");
  console.log("1. Clear the Prismatic 'Salesforce Private Key' field completely");
  console.log("2. Copy FORMAT 1 (multi-line) exactly as shown above");
  console.log("3. Paste into Prismatic (no extra spaces)");
  console.log("4. Save configuration");
  console.log("5. If FORMAT 1 doesn't work, try FORMAT 2");
}

// Process the key
const cleanedKey = cleanPrivateKey(YOUR_PRIVATE_KEY);
generatePrismaticFormats(cleanedKey);