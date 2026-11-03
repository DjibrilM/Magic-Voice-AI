import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { IpcProvider } from '@/components/providers/IpcProvider'
import { AudioProvider } from '@/components/providers/AudioProvider'

function App() {
  return (
    <IpcProvider>
      <AudioProvider>
        <RouterProvider router={router} />
      </AudioProvider>
    </IpcProvider>
  )
}

export default App
