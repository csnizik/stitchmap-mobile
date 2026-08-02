import { Canvas, Circle } from '@shopify/react-native-skia';

export default function SkiaSmokeTest() {
  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <Circle cx={100} cy={100} r={80} color="#c96480" />
    </Canvas>
  );
}
