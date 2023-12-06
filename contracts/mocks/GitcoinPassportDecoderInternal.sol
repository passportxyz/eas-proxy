import {Attestation, IEAS} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import {GitcoinPassportDecoder} from "../GitcoinPassportDecoder.sol";
import {IGitcoinResolver} from "../IGitcoinResolver.sol";

/**
 * @title GitcoinPassportDecoderInternal
 * @author
 * @notice This was created so that it will expose the internal function from GitcoinPassportDecoder to be able to test them
 */
contract GitcoinPassportDecoderInternal is GitcoinPassportDecoder {
  function isScoreAttestationExpired(
    Attestation memory attestation
  ) external view returns (bool) {
    return _isScoreAttestationExpired(attestation);
  }

  function isCachedScoreExpired(
    IGitcoinResolver.CachedScore memory score
  ) external view returns (bool) {
    return _isCachedScoreExpired(score);
  }
}
