// Import dependencies
import { expect } from 'chai';
import BIP322 from "../src/BIP322";
import ECPairFactory from 'ecpair';
import { Witness } from '../src/helpers';
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';

// Import module to be tested
import Verifier from '../src/Verifier';

// Tests
describe('Verifier Test', () => {

    it('Can verify legacy P2PKH signature', () => {
        // Arrange
        // Test vector copied from https://github.com/bitcoinjs/bitcoinjs-message/blob/c43430f4c03c292c719e7801e425d887cbdf7464/README.md?plain=1#L21
        const address = "1F3sAm6ZtwLAUnj7d38pGFxtP3RVEvtsbV";
        const addressWrong = "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2";
        const message = "This is an example of a signed message.";
        const messageWrong = "";
        const signature = "H9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk=";

        // Act
        const resultCorrect = Verifier.verifySignature(address, message, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, message, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongAddress).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for P2SH-P2WPKH address', () => {
        // Arrange
        // Constants
        const privateKey = "KwTbAxmBXjoZM3bzbXixEr9nxLhyYSM4vp2swet58i19bw9sqk5z"; // Private key of "3HSVzEhCFuH9Z3wvoWTexy7BMVVp3PjS6f", also serve to test public key that begins with 0x03
        const address = "3HSVzEhCFuH9Z3wvoWTexy7BMVVp3PjS6f"; // Derived from the private key above
        const addressWrong = "342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey";
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2sh({
			address: address
		}).output as Buffer;
        // Derive the P2SH-P2WPKH redeemScript from the corresponding hashed public key
        const redeemScript = bitcoin.payments.p2wpkh({
			hash: bitcoin.crypto.hash160(testPrivateKey.publicKey)
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft a toSign transaction that spends toSpend transaction
        const toSignTx = BIP322.buildToSignTx(toSpendTx.getId(), redeemScript, true);
        // Sign the toSign transaction
        const toSignTxSigned = toSignTx.signAllInputs(testPrivateKey).finalizeAllInputs();
        // Extract the signature
        const signature = BIP322.encodeWitness(toSignTxSigned);

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongAddress).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for P2WPKH address', () => {
        // Arrange
        // Test vectors listed at https://github.com/bitcoin/bips/blob/master/bip-0322.mediawiki#user-content-Test_vectors
        const address = "bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l";
        const addressWrong = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
        const messageEmpty = "";
        const messageHelloWorld = "Hello World";
        const signatureEmpty = "AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=";
        const signatureHelloWorld = "AkcwRAIgZRfIY3p7/DoVTty6YZbWS71bc5Vct9p9Fia83eRmw2QCICK/ENGfwLtptFluMGs2KsqoNSk89pO7F29zJLUx9a/sASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI=";
        // Additional test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2713
        const signatureHelloWorldAlt = "AkgwRQIhAOzyynlqt93lOKJr+wmmxIens//zPzl9tqIOua93wO6MAiBi5n5EyAcPScOjf1lAqIUIQtr3zKNeavYabHyR8eGhowEhAsfxIAMZZEKUPYWI4BruhAQjzFT8FSFSajuFwrDL1Yhy";
        
        // Act
        // Correct addresses and correct signature
        const resultEmptyValid = Verifier.verifySignature(address, messageEmpty, signatureEmpty);
        const resultHelloWorldValid = Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorld);
        const resultHelloWorldValidII =  Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorldAlt);
        // Correct addresses but incorrect signature
        const resultHelloWorldInvalidSig = Verifier.verifySignature(address, messageEmpty, signatureHelloWorld); // Mixed up the signature and message - should be false
        const resultEmptyInvalidSig = Verifier.verifySignature(address, messageHelloWorld, signatureEmpty); // Mixed up the signature and message - should be false
        // Incorrect addresses
        const resultEmptyInvalidAddress = Verifier.verifySignature(addressWrong, messageEmpty, signatureEmpty); // Wrong address - should be false
        const resultHelloWorldInvalidAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false
        
        // Assert
        expect(resultEmptyValid).to.be.true;
        expect(resultHelloWorldValid).to.be.true;
        expect(resultHelloWorldValidII).to.be.true;
        expect(resultHelloWorldInvalidSig).to.be.false;
        expect(resultEmptyInvalidSig).to.be.false; 
        expect(resultEmptyInvalidAddress).to.be.false;
        expect(resultHelloWorldInvalidAddress).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for single-key-spend P2TR address using SIGHASH_ALL flag', () => {
        // Arrange
        // Test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2747
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const addressWrong = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        const signatureHelloWorld = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signatureHelloWorld); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signatureHelloWorld); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signatureHelloWorld); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongAddress).to.be.false;
    });

    it('Can verify and falsify BIP-322 signature for single-key-spend P2TR address using SIGHASH_DEFAULT flag', () => {
        // Arrange
        const privateKey = 'L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k'; // Private key of bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const addressWrong = "bc1p5d7rjq7g6rdk2yhzks9smlaqtedr4dekq08ge8ztwac72sfr9rusxg3297";
        const messageWrong = "";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Extract the taproot internal public key
        const internalPublicKey = testPrivateKey.publicKey.subarray(1, 33);
        // Tweak the private key for signing, since the output and address uses tweaked key
        // Reference: https://github.com/bitcoinjs/bitcoinjs-lib/blob/1a9119b53bcea4b83a6aa8b948f0e6370209b1b4/test/integration/taproot.spec.ts#L55
        const testPrivateKeyTweaked = testPrivateKey.tweak(
            bitcoin.crypto.taggedHash('TapTweak', testPrivateKey.publicKey.subarray(1, 33))
        );
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2tr({
			address: address
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft a toSign transaction that spends toSpend transaction
        const toSignTx = BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey);
        // Sign the toSign transaction
        const toSignTxSigned = toSignTx.signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_DEFAULT]).finalizeAllInputs();
        // Extract the signature
        const signature = BIP322.encodeWitness(toSignTxSigned);

        // Act
        const resultCorrect = Verifier.verifySignature(address, messageHelloWorld, signature); // Everything correct
        const resultWrongMessage = Verifier.verifySignature(address, messageWrong, signature); // Wrong message - should be false
        const resultWrongAddress = Verifier.verifySignature(addressWrong, messageHelloWorld, signature); // Wrong address - should be false

        // Assert
        expect(resultCorrect).to.be.true;
        expect(resultWrongMessage).to.be.false;
        expect(resultWrongAddress).to.be.false;
    });

    it('Refuse to verify P2WSH transaction', () => {
        // Arrange
        // Taken from transaction 4221ff28411a87e6d412458689c471b875dd43aca7d02c7fb7c7331855581434
        const address = 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3';
        const message = ''; // Does not actually matter, it should throw due to the P2WSH address anyway
        const signature = 'ApAzMDQ1MDIyMTAwYzkzMWY5YzAxZmU2ZjRlNGY2N2M1NTY0NDc2NDY1OTI4OWQ4ZDRjYzcyM2ZlODJkZDJiOTdmYmZkYTA2NGJlYzAyMjAwZGZkNTg2ZjU4YzllZGJhODc0ZTBjZWY2NmU5ZmU5MWU3YWE3YTZjZGRkNmExZjU3MmVmYjY2ZmU5Y2FlZjJlMDFGMjEwMjc5YmU2NjdlZjlkY2JiYWM1NWEwNjI5NWNlODcwYjA3MDI5YmZjZGIyZGNlMjhkOTU5ZjI4MTViMTZmODE3OThhYw==';
        
        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, message, signature);

        // Assert
        expect(result).to.throw('Only P2WPKH, P2SH-P2WPKH, and single-key-spend P2TR BIP-322 verification is supported. Unsupported address is provided.');
    });

    it('Refuse to verify script-spend P2TR transaction', () => {
        // Arrange
        // Taken from transaction d1042c9db36af59586e5681feeace356e85599a8fc0000cc50e263186a9c2276 which is an ordinal inscription transaction
        const address = 'bc1p3r88nsysd8sv555nur4h85wdupa5z0xpcgcdjxy5up30re8gcneswrkwkv';
        const message = ''; // Does not actually matter, it should throw due to the script-path spend included in the witness stack
        const signature = 'A4AxODdkNTJkNGVkNDQ2OThlY2M5NjJlZDc0ZDdmODIyODIwNDc1YTc1NjdjMTViYmFkOGY5MWNlOTZkMGYxMzJkMmQxM2U0MzA3OWFlNzAwMTE5YzkxYTQ2MjA4Yzk5NWUzYTE4YjUzNjYzNjhkZDA0NDUwYzNmZjU2NTIyMWQyY+AyMDVkZTgxNTRlNzBkNmFmNTI5MDZhNGM0ZDc4OThiMDE4MGRlNWRiOGI3Y2Q0NGNiZDI3Y2RkZmY3NzUxY2ViYzdhYzAwNjMwMzZmNzI2NDAxMDExODc0NjU3ODc0MmY3MDZjNjE2OTZlM2I2MzY4NjE3MjczNjU3NDNkNzU3NDY2MmQzODAwMmE3YjIyNzAyMjNhMjI3MzZlNzMyMjJjMjI2ZjcwMjIzYTIyNzI2NTY3MjIyYzIyNmU2MTZkNjUyMjNhMjIzNjMzMzEzMjM4MmU3MzYxNzQ3MzIyN2Q2OEJjMDVkZTgxNTRlNzBkNmFmNTI5MDZhNGM0ZDc4OThiMDE4MGRlNWRiOGI3Y2Q0NGNiZDI3Y2RkZmY3NzUxY2ViYzc=';
        
        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, message, signature);

        // Assert
        expect(result).to.throw('BIP-322 verification from script-spend P2TR is unsupported.');
    });

    it('Reject any signature from malformed address', () => {
        // Arrange
        const malformP2PKH = '1F3sAm6ZtwLAUnj7d38pGFxtP3RVEvtsbV' + 'M';
        const malformP2WPKHInP2SH = '37qyp7jQAzqb2rCBpMvVtLDuuzKAUCVnJb' + 'M';
        const malformedP2WPKH = 'bc1q9vza2e8x573nczrlzms0wvx3gsqjx7vavgkx0l' + 'm';
        const malformedP2TR = 'bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3' + 'm';
        const malformedP2WTF = 'bc1wtfpv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3'; // bc1wtf
        const message = ''; // Does not actually matter, it should throw due to the malformed address
        const signatureP2PKH = "H9L5yLFjti0QTHhPyFrZCT1V/MMnBtXKmoiKDZ78NDBjERki6ZTQZdSMCtkgoNmp17By9ItJr8o7ChX0XxY91nk="; // Correctly encoded P2PKH signature
        const signatureP2WPKH = "AkcwRAIgM2gBAQqvZX15ZiysmKmQpDrG83avLIT492QBzLnQIxYCIBaTpOaD20qRlEylyxFSeEA2ba9YOixpX8z46TSDtS40ASECx/EgAxlkQpQ9hYjgGu6EBCPMVPwVIVJqO4XCsMvViHI="; // Correctly encoded P2WPKH signature
        const signatureP2TR = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ=="; // Correctly encoded P2TR signature

        // Act
        const resultP2PKH = Verifier.verifySignature.bind(Verifier, malformP2PKH, message, signatureP2PKH);
        const resultP2WPKHInP2SH = Verifier.verifySignature.bind(Verifier, malformP2WPKHInP2SH, message, signatureP2WPKH);
        const resultP2WPKH = Verifier.verifySignature.bind(Verifier, malformedP2WPKH, message, signatureP2WPKH);
        const resultP2Tr = Verifier.verifySignature.bind(Verifier, malformedP2TR, message, signatureP2TR);
        const resultP2WTF = Verifier.verifySignature.bind(Verifier, malformedP2WTF, signatureP2TR);

        // Assert
        expect(resultP2PKH).to.throw('Invalid checksum'); // Throw by bitcoinjs-message library
        expect(resultP2WPKHInP2SH).to.throw('Invalid checksum'); // Throw by bitcoinjs-lib
        expect(resultP2WPKH).to.throws('Unknown address type');
        expect(resultP2Tr).to.throws('Unknown address type');
        expect(resultP2WTF).to.throws('Unknown address type');
    });

    it('Reject Schnorr signature with incorrect length', () => {
        // Arrange
        // Test vector listed at https://github.com/bitcoin/bitcoin/blob/29b28d07fa958b89e1c7916fda5d8654474cf495/src/test/util_tests.cpp#L2747
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const messageHelloWorld = "Hello World";
        const signatureHelloWorld = "AUHd69PrJQEv+oKTfZ8l+WROBHuy9HKrbFCJu7U1iK2iiEy1vMU5EfMtjc+VSHM7aU0SDbak5IUZRVno2P5mjSafAQ==";
        // Deserialize the signature
        const signatureHelloWorldDeserialized = Witness.deserialize(signatureHelloWorld)[0];
        // Append an extra byte at the end of signatureHelloWorld
        const signatureHelloWorldExtraByte = Buffer.concat([signatureHelloWorldDeserialized, Buffer.from([0xFF])]);
        // Serialize the modified signature into base64
        const signatureHelloWorldExtraByteSerialized = Witness.serialize([signatureHelloWorldExtraByte]);

        // Act
        const result = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureHelloWorldExtraByteSerialized); // Schnorr signature with incorrect length

        // Assert
        expect(result).to.throw('Invalid Schnorr signature provided.');
    });

    it('Reject signature signed using invalid SIGHASH', () => {
        // Arrange
        const privateKey = 'L3VFeEujGtevx9w18HD1fhRbCH67Az2dpCymeRE1SoPK6XQtaN2k'; // Private key of bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3
        const address = "bc1ppv609nr0vr25u07u95waq5lucwfm6tde4nydujnu8npg4q75mr5sxq8lt3";
        const messageHelloWorld = "Hello World";
        // Initialize private key used to sign the transaction
        const ECPair = ECPairFactory(ecc);
        const testPrivateKey = ECPair.fromWIF(privateKey);
        // Extract the taproot internal public key
        const internalPublicKey = testPrivateKey.publicKey.subarray(1, 33);
        // Tweak the private key for signing, since the output and address uses tweaked key
        // Reference: https://github.com/bitcoinjs/bitcoinjs-lib/blob/1a9119b53bcea4b83a6aa8b948f0e6370209b1b4/test/integration/taproot.spec.ts#L55
        const testPrivateKeyTweaked = testPrivateKey.tweak(
            bitcoin.crypto.taggedHash('TapTweak', testPrivateKey.publicKey.subarray(1, 33))
        );
        // Obtain the script public key
        const scriptPubKey = bitcoin.payments.p2tr({
			address: address
		}).output as Buffer;
        // Draft a toSpend transaction with messageHelloWorld
        const toSpendTx = BIP322.buildToSpendTx(messageHelloWorld, scriptPubKey);
        // Draft, sign the toSign transaction, and extract the signature using different SIGHASH
        const signatureAnyOneCanPay = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_ANYONECANPAY })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_ANYONECANPAY]).finalizeAllInputs()
        );
        const signatureInputMask = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_INPUT_MASK })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_INPUT_MASK]).finalizeAllInputs()
        );
        const signatureNone = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_NONE })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_NONE]).finalizeAllInputs()
        );
        const signatureOutputMask = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_OUTPUT_MASK })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_OUTPUT_MASK]).finalizeAllInputs()
        );
        const signatureSingle = BIP322.encodeWitness(
            BIP322.buildToSignTx(toSpendTx.getId(), scriptPubKey, false, internalPublicKey)
                .updateInput(0, { sighashType: bitcoin.Transaction.SIGHASH_SINGLE })
                .signAllInputs(testPrivateKeyTweaked, [bitcoin.Transaction.SIGHASH_SINGLE]).finalizeAllInputs()
        );

        // Act
        const resultAnyOneCanPay = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureAnyOneCanPay);
        const resultInputMask = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureInputMask);
        const resultNone = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureNone);
        const resultOutputMask = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureOutputMask);
        const resultSingle = Verifier.verifySignature.bind(Verifier, address, messageHelloWorld, signatureSingle);

        // Assert
        expect(resultAnyOneCanPay).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultInputMask).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultNone).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultOutputMask).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
        expect(resultSingle).to.throws('Invalid SIGHASH used in signature. Must be either SIGHASH_ALL or SIGHASH_DEFAULT.');
    });

});