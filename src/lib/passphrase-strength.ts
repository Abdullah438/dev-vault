import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as en from '@zxcvbn-ts/language-en';

let zxcvbn: ZxcvbnFactory | null = null;

function getZxcvbn(): ZxcvbnFactory {
  if (!zxcvbn) {
    zxcvbn = new ZxcvbnFactory({
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
      graphs: common.adjacencyGraphs,
      translations: en.translations,
    });
  }
  return zxcvbn;
}

export type PassphraseAssessment = {
  score: number;
  acceptable: boolean;
  warning: string;
  suggestions: string[];
};

const MIN_LENGTH = 12;
const MIN_SCORE = 3;

export function assessPassphrase(passphrase: string): PassphraseAssessment {
  const result = getZxcvbn().check(passphrase);
  const acceptable = passphrase.length >= MIN_LENGTH && result.score >= MIN_SCORE;

  return {
    score: result.score,
    acceptable,
    warning: result.feedback.warning ?? '',
    suggestions: result.feedback.suggestions,
  };
}

export function isPassphraseAcceptable(passphrase: string): boolean {
  return assessPassphrase(passphrase).acceptable;
}
