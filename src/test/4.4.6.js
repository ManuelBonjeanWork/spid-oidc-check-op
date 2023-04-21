const TestUserinfoResponse = require("../server/lib/test/TestUserinfoResponse.js");
const validator = require("../server/node_modules/validator");
const utility = require("../server/lib/utils");
const jose = require("../server/node_modules/node-jose");
const fs = require("fs");
const private_key = fs.readFileSync(__dirname + "/../config/spid-oidc-check-op-enc.key", "utf8");

class Test_4_4_6 extends TestUserinfoResponse {
  constructor(metadata, authrequest, authresponse, tokenrequest, tokenresponse, userinforequest, userinforesponse) {
    super(metadata, authrequest, authresponse, tokenrequest, tokenresponse, userinforequest, userinforesponse);
    this.num = "4.4.6";
    this.description = "Userinfo Signed Token Payload: the value of iss MUST be equal to the URL of the OP";
    this.validation = "automatic";
  }

  async exec() {
    super.exec();

    let userinfo_token = this.userinforesponse.data;

    if (typeof this.userinforesponse.data != "string") {
      this.notes = this.userinforesponse.data;
      throw "the content of body is not a valid JWT string";
    }

    if (!utility.isJWT(userinfo_token, true)) {
      this.notes = userinfo_token;
      throw "userinfo data is not a valid JWT";
    }

    let keystore_rp = jose.JWK.createKeyStore();
    await keystore_rp.add(private_key, "pem");
    let userinfo_sig_token_obj = await jose.JWE.createDecrypt(keystore_rp).decrypt(userinfo_token);
    let userinfo_sig_token = userinfo_sig_token_obj.payload.toString();

    if (!validator.isJWT(userinfo_sig_token)) {
      this.notes = userinfo_sig_token;
      throw "userinfo data is not a valid JWT";
    }

    // I Relying Party (RP) devono usare jwks o signed_jwks_uri (Avv. SPID n.41 v.2)

    if (!this.metadata.configuration.jwks && !this.metadata.configuration.signed_jwks_uri) {
      this.notes = this.metadata.configuration;
      throw "neither jwks or signed_jwks_uri is present";
    }

    let op_jwks = this.metadata.configuration.jwks;

    if (!op_jwks) {
      //let op_signed_jwks = (await axios.get(this.metadata.configuration.signed_jwks_uri)).data;
      this.notes = "signed_jwks_uri is not yet implemented. Please refer to AgID.";
      throw "OP uses signed_jwks_uri";
    }

    if (op_jwks.keys == null || op_jwks.keys == "") {
      this.notes = op_jwks;
      throw "JWKS of OP not found";
    }

    let keystore_op = jose.JWK.createKeyStore();
    for (let k in op_jwks.keys) {
      await keystore_op.add(op_jwks.keys[k], "json");
    }

    let userinfo_sig_token_verified = await jose.JWS.createVerify(keystore_op).verify(userinfo_sig_token);
    userinfo_sig_token_verified.payload = JSON.parse(userinfo_sig_token_verified.payload.toString());

    if (userinfo_sig_token_verified.payload.iss == null || userinfo_sig_token_verified.payload.iss == "") {
      this.notes = userinfo_sig_token_verified.payload;
      throw "claim iss is not present";
    }

    if (!validator.isURL(userinfo_sig_token_verified.payload.iss)) {
      this.notes = userinfo_sig_token_verified.payload.iss;
      throw "the value of iss is not a valid URL";
    }

    if (!this.metadata.url.includes(userinfo_sig_token_verified.payload.iss)) {
      this.notes = userinfo_sig_token_verified.payload.iss;
      throw "the value of iss not match the metadata URL of the OP";
    }

    this.notes = userinfo_sig_token_verified.payload.iss;

    return true;
  }
}

module.exports = Test_4_4_6;
