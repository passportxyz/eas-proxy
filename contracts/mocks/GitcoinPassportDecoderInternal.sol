import {GitcoinPassportDecoder} from "../GitcoinPassportDecoder.sol";
import {IGitcoinResolver} from "../IGitcoinResolver.sol";

/**
 * @title GitcoinPassportDecoderInternal
 * @author
 * @notice This was created so that it will expose the internal function from GitcoinPassportDecoder to be able to test them
 */
contract GitcoinPassportDecoderInternal is GitcoinPassportDecoder {
  function checkExpiration(
    IGitcoinResolver.CachedScore memory score
  ) external view {
    return _checkExpiration(score);
  }
}
