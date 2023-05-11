const TestMetadata = require('../server/lib/test/TestMetadata.js');
const jwt_decode = require('../server/node_modules/jwt-decode');

class Test_1_2_15 extends TestMetadata {
  constructor(metadata) {
    super(metadata);
    this.num = '1.2.15';
    this.description = 'The document MUST contain the claim metadata';
    this.validation = 'automatic';
  }

  async exec() {
    super.exec();
    this.notes = jwt_decode(this.metadata.entity_statement).metadata;
    if (this.notes == null || this.notes == '') {
      throw 'claim metadata is not present';
    }
    return true;
  }
}

module.exports = Test_1_2_15;
