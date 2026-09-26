/**
 * A finger-drawn signature pad — hand-rolled on `react-native-svg` (already
 * a dependency) + `PanResponder`, the same zero-extra-dependency approach a
 * sibling field app's consent flow uses (crediqs's SignatureCanvas), rather
 * than pulling in a dedicated signature-pad package for one small drawing
 * surface. Always a white background regardless of theme -- this is a mark
 * that may end up printed/exported, and needs to read the same way on
 * paper as it does in either color scheme.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Path } from "react-native-svg";

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  /** Base64 PNG, no `data:` prefix — resolves once the native module has
   * rasterized the current strokes. */
  toBase64: () => Promise<string>;
}

interface SignaturePadProps {
  height?: number;
  onChange?: (empty: boolean) => void;
}

// Caps each stroke's point count so a long, wandering signature doesn't
// grow one <Path>'s `d` string (and SVG layout cost) unboundedly -- once
// hit, the stroke is committed and a fresh one picks up from the same
// point, invisibly to whoever's signing.
const MAX_POINTS_PER_STROKE = 200;

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { height = 160, onChange },
  ref,
) {
  const svgRef = useRef<Svg>(null);
  const [committedPaths, setCommittedPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const pointCount = useRef(0);

  useImperativeHandle(ref, () => ({
    isEmpty: () => committedPaths.length === 0 && currentPath === "",
    clear: () => {
      setCommittedPaths([]);
      setCurrentPath("");
      onChange?.(true);
    },
    toBase64: () =>
      new Promise<string>((resolve, reject) => {
        if (!svgRef.current) {
          reject(new Error("Signature pad isn't ready yet."));
          return;
        }
        svgRef.current.toDataURL((base64: string) => resolve(base64));
      }),
  }));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        setCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`);
        pointCount.current = 1;
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (pointCount.current >= MAX_POINTS_PER_STROKE) {
          setCommittedPaths((prev) => [...prev, currentPath]);
          setCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`);
          pointCount.current = 1;
          return;
        }
        setCurrentPath((prev) => `${prev} L${x.toFixed(1)},${y.toFixed(1)}`);
        pointCount.current += 1;
      },
      onPanResponderRelease: () => {
        setCommittedPaths((prev) => (currentPath ? [...prev, currentPath] : prev));
        setCurrentPath("");
        onChange?.(false);
      },
    }),
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={{ height, backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" }}
    >
      <Svg ref={svgRef} height="100%" width="100%">
        {committedPaths.map((d, i) => (
          <Path key={i} d={d} stroke="#0f172a" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {currentPath ? (
          <Path d={currentPath} stroke="#0f172a" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
      </Svg>
    </View>
  );
});
