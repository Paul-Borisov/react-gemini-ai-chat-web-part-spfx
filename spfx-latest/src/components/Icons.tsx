import * as React from 'react';
import styles from './Chat.module.scss';

export function getGeminiAiLogo(className: string = undefined): JSX.Element {
  return (
    <div className={[styles.geminiailogo, className].join(' ').trim()}>
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" fill="none">
        <path
          d="M128 256C128 238.293 124.587 221.653 117.76 206.08C111.147 190.507 102.08 176.96 90.56 165.44C79.04 153.92 65.4933 144.853 49.92 138.24C34.3467 131.413 17.7067 128 0 128C17.7067 128 34.3467 124.693 49.92 118.08C65.4933 111.253 79.04 102.08 90.56 90.56C102.08 79.04 111.147 65.4933 117.76 49.92C124.587 34.3467 128 17.7067 128 0C128 17.7067 131.307 34.3467 137.92 49.92C144.747 65.4933 153.92 79.04 165.44 90.56C176.96 102.08 190.507 111.253 206.08 118.08C221.653 124.693 238.293 128 256 128C238.293 128 221.653 131.413 206.08 138.24C190.507 144.853 176.96 153.92 165.44 165.44C153.92 176.96 144.747 190.507 137.92 206.08C131.307 221.653 128 238.293 128 256Z"
          fill="url(#paint0_radial_897_38)"
        />
        <defs>
          <radialGradient
            id="paint0_radial_897_38"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(256) rotate(135) scale(362.039 181.019)"
          >
            <stop offset="0.325427" stop-color="#FFDDB7" />
            <stop offset="0.70596" stop-color="#076EFF" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
