import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene />
      </Canvas>
    </div>
  )
}

export default App
