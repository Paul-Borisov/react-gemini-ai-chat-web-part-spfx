import { FontIcon, TooltipHost } from '@fluentui/react';
import * as strings from 'GeminiAiChatWebPartStrings';
import * as React from 'react';
import 'regenerator-runtime/runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import useSpeech from 'shared/hooks/useSpeech';
import { IVoice } from 'shared/model/IVoice';
import Languages from './Languages';
import styles from './Speech.module.scss';

interface IVoiceInput extends IVoice {
  setText?: (text: string) => void;
  shortLeftMargin?: boolean;
}

const VoiceInput: React.FunctionComponent<IVoiceInput> = (props) => {
  const {
    transcript,
    resetTranscript,
    browserSupportsContinuousListening,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();
  const { showLocales, setShowLocales, started, setStarted } = useSpeech();

  const handleSpeechRecognition = (locale: string = 'en-US') => {
    if (!started) {
      setStarted(true);
      resetTranscript();
      const params = {};
      if (browserSupportsContinuousListening) params['continuous'] = true;
      if (locale) params['language'] = locale;
      SpeechRecognition.startListening(params);
    } else {
      setStarted(false);
      SpeechRecognition.stopListening();
      props.setText(transcript);
    }
  };

  const isAvailable = !!browserSupportsSpeechRecognition && !!isMicrophoneAvailable;
  return isAvailable ? (
    <>
      {!started ? (
        <FontIcon
          iconName={'Microphone'}
          className={[styles.microphone, props.shortLeftMargin ? styles.shortLeftMargin : undefined].join(' ')}
          onClick={() => setShowLocales(true)}
          title={props.tooltip ?? strings.TextVoiceInput}
        />
      ) : (
        <FontIcon
          iconName={'CircleStopSolid'}
          className={[styles.microphone, styles.stop, props.shortLeftMargin ? styles.shortLeftMargin : undefined].join(' ')}
          onClick={() => handleSpeechRecognition()}
          title={strings.TextStop}
        />
      )}
      {showLocales ? (
        <Languages handleSelection={handleSpeechRecognition} isOpen={showLocales} setIsOpen={setShowLocales} />
      ) : null}
    </>
  ) : (
    <FontIcon
      iconName={'Microphone'}
      className={[styles.microphone, styles.unavailable, props.shortLeftMargin ? styles.shortLeftMargin : undefined].join(' ')}
      title={strings.TextDeviceUnavailable}
    />
  );
};

export default VoiceInput;
