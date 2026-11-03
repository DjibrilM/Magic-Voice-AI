import { createHashRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/layouts/RootLayout'
import { TextToSpeechPage } from '@/pages/TextToSpeech'
import { Settings } from '@/pages/Settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <TextToSpeechPage />,
      },
      {
        path: 'text-to-speech',
        element: <TextToSpeechPage />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
])
