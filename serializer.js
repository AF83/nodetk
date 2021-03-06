var crypto = require('crypto')
  , random_str = require('nodetk/random_str')
  ;


var SERIALIZER = exports;

SERIALIZER.utf8_to_b64 = function(str) {
  /* Returns base64 encoded version of given utf8 string. */
  return  (new Buffer(str, "utf8")).toString("base64");
};

SERIALIZER.b64_to_utf8 = function(b64) {
  /* Returns uf8 decoded version of given base64 encoded string. */
  return (new Buffer(b64, "base64")).toString("utf8");
};


SERIALIZER.dump_str = function(obj) {
  /* Returns dump of the given JSON obj as a str.
   * There is no encryption, and it might not be safe.
   * Might throw an error.
   *
   * Arguments:
   *  - obj: JSON obj.
   *
   */
  return SERIALIZER.utf8_to_b64(JSON.stringify(obj));
};


SERIALIZER.load_str = function(str) {
  /* Returns obj loaded from given string.
   * Might throw an error.
   *
   * Arguments:
   *  - str: string representation of obj to load.
   *
   */
  return JSON.parse(SERIALIZER.b64_to_utf8(str));
};


var sign_str = function(str, key) {
  /* Return base64url signed sha1 hash of str using key */
  var hmac = crypto.createHmac('sha1', key);
  hmac.update(str);
  return hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
};


var CYPHER = 'aes256';
var CODE_ENCODING = "hex";
var DATA_ENCODING = "utf8";

SERIALIZER.dump_secure_str = function(obj, encrypt_key, validate_key) {
  /* Return str representing the given obj. It is signed and encrypted using the
   * given keys.
   */
  // TODO XXX: check the validity of the process
  // Do we need some timestamp to invalidate too old data?
  var nonce_check = random_str.randomString(48); // 8 chars
  var nonce_crypt = random_str.randomString(48); // 8 chars
  var cypher = crypto.createCipher(CYPHER, encrypt_key + nonce_crypt);
  var data = JSON.stringify(obj);
  var res = cypher.update(nonce_check, DATA_ENCODING, CODE_ENCODING);
  res += cypher.update(data, DATA_ENCODING, CODE_ENCODING);
  res += cypher.final(CODE_ENCODING);
  var digest = sign_str(data, validate_key + nonce_check);
  return digest + nonce_crypt + res;
};

SERIALIZER.load_secure_str = function(str, encrypt_key, validate_key) {
  /* Given a string resulting from dump_secure_str, load corresponding JSON.
   */
  var expected_digest = str.substring(0, 28);
  var nonce_crypt = str.substring(28, 36);
  var encrypted_data = str.substring(36, str.length);
  var decypher = crypto.createDecipher(CYPHER, encrypt_key + nonce_crypt);
  var data = decypher.update(encrypted_data, CODE_ENCODING, DATA_ENCODING);
  data += decypher.final(DATA_ENCODING);
  var nonce_check = data.substring(0, 8);
  data = data.substring(8, data.length);
  var digest = sign_str(data, validate_key + nonce_check);
  if(digest != expected_digest) throw new Error("Bad digest");
  return JSON.parse(data);
};


SERIALIZER.SecureSerializer = function(encrypt_key, validate_key) {
  /* Class to store encryption/validation keys in a more convenient way. */
  this.encrypt_key = encrypt_key;
  this.validate_key = validate_key;
};
SERIALIZER.SecureSerializer.prototype = {
  dump_str: function(obj) {
    return SERIALIZER.dump_secure_str(obj, this.encrypt_key, this.validate_key);
  }
, load_str: function(str) {
    return SERIALIZER.load_secure_str(str, this.encrypt_key, this.validate_key);
  }
};


