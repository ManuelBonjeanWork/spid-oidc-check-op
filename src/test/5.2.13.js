const TestIntrospectionResponse = require('../server/lib/test/TestIntrospectionResponse.js');

class Test_5_2_13 extends TestIntrospectionResponse {
  constructor(
    metadata,
    authrequest,
    authresponse,
    tokenrequest,
    tokenresponse,
    refreshtokenrequest,
    refreshtokenresponse,
    userinforequest,
    userinforesponse,
    introspectionrequest,
    introspectionresponse
  ) {
    super(
      metadata,
      authrequest,
      authresponse,
      tokenrequest,
      tokenresponse,
      refreshtokenrequest,
      refreshtokenresponse,
      userinforequest,
      userinforesponse,
      introspectionrequest,
      introspectionresponse
    );
    this.num = '5.2.13';
    this.description =
      'Introspection Response:if active=true, parameter aud MUST be present';
    this.validation = 'self';
  }
  async exec() {
    if (this.introspectionresponse.active == 'true') {
      if (
        this.introspectionresponse.aud == null ||
        this.introspectionresponse.aud == ''
      ) {
        throw 'Parameter aud is not present';
      } else {
        this.notes = this.introspectionresponse.aud;
        return true;
      }
    } else {
      this.notes = this.introspectionresponse.active;
      return true;
    }
  }
}

module.exports = Test_5_2_13;
