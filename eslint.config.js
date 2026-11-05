import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist','.claude']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // KONO Medal Cove is developed as its own project and copied in whole (see src/components/MedalCove.tsx);
    // that project's lint is looser, so these style and React-compiler rules are off for its files here,
    // to keep them identical to its source.
    files: [
      'src/components/{MedalCove,BonusCanvas,BonusConsole,BonusDraw,BonusReveals,KonoCinema,MechanismPreview,TideDeliveryPanel}.tsx',
      'src/components/{cameraControl,framing,localReveals,machineEventScreen,machineFeedback,referenceCabinet,sanctuaryAssets,towerCeremony}.ts',
      'src/store/{boardClear,bonusReveals,contactAccuracy,delivery,dispense,flipper,frameBudget,interaction,motion,practice,rewardRoute,tide,tower}.ts',
      'src/{medalMusic,useMedalMusic}.ts',
      'tools/cinema_review.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'off',
      'no-empty': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
])
