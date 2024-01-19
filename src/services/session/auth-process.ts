import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/typescript-types';
import { Authenticator } from '@/services/session/user';

const RP_NAME = 'SoundOfTheSky';
const RP_ID = process.env['HTTP_ORIGIN']!.slice(8);
const RP_ORIGIN = process.env['HTTP_ORIGIN']!;
const CHALLENGE_TIMEOUT = 120_000;

const challenges = new Map<
  string,
  {
    data: string;
    exp: number;
  }
>();
export const removeChallenge = (sub: string) => challenges.delete(sub);
export const setChallenge = (sub: string, challenge: string) => {
  challenges.set(sub, {
    data: challenge,
    exp: Date.now() + CHALLENGE_TIMEOUT,
  });
};
export const getChallenge = (sub: string) => {
  const challenge = challenges.get(sub);
  if (!challenge || challenge.exp < Date.now()) return;
  return challenge.data;
};
export function getLoginOptions(userAuthenticators: Authenticator[]) {
  return generateAuthenticationOptions({
    allowCredentials: userAuthenticators.map((authenticator) => ({
      id: authenticator.credentialID,
      type: 'public-key',
      transports: authenticator.transports,
    })),
    userVerification: 'preferred',
    timeout: CHALLENGE_TIMEOUT,
    rpID: RP_ID,
  });
}
export async function verifyLogin(
  authenticator: Authenticator,
  expectedChallenge: string,
  response: AuthenticationResponseJSON,
) {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge: expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    authenticator,
    requireUserVerification: false,
  });
}
export function getRegistrationOptions(username: string) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: username,
    userName: username,
    attestationType: 'none',
    timeout: CHALLENGE_TIMEOUT,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    userDisplayName: username,
  });
}
export function verifyRegistration(expectedChallenge: string, response: RegistrationResponseJSON) {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: RP_ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });
}
setInterval(() => {
  const now = Date.now();
  for (const [sub, challenge] of challenges.entries()) if (challenge.exp < now) challenges.delete(sub);
}, CHALLENGE_TIMEOUT);
