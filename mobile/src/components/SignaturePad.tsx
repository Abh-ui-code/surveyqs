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
import { PanResponder, Text, View } from "react-native";
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
  // `PanResponder.create(...)` is only ever built once (below, via
  // `useRef(...).current`), so its handlers close over whatever `currentPath`
  // was on that first render -- forever, not the latest value. Reading
  // `currentPath` (the state) directly from inside a handler was the bug:
  // on release it always saw the initial "", so the stroke never made it
  // into `committedPaths` and then got wiped by `setCurrentPath("")`,
  // making the signature disappear the instant a finger lifted. Handlers
  // read/write this ref instead, which is always current; `currentPath`
  // (the state) still drives what's actually drawn on screen.
  const currentPathRef = useRef("");
  const pointCount = useRef(0);

  function updateCurrentPath(next: string) {
    currentPathRef.current = next;
    setCurrentPath(next);
  }

  function commitCurrentPath() {
    if (currentPathRef.current) {
      const path = currentPathRef.current;
      setCommittedPaths((prev) => [...prev, path]);
    }
    updateCurrentPath("");
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => committedPaths.length === 0 && currentPathRef.current === "",
    clear: () => {
      setCommittedPaths([]);
      updateCurrentPath("");
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
      // A signature stroke is exactly the kind of vertical drag a parent
      // ScrollView tries to claim for itself mid-gesture -- refuse to give
      // it up once a finger is down, or a stroke gets silently cut off.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        updateCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`);
        pointCount.current = 1;
      },
      onPanResponderMove: (e) => {
        const { locationX: x, locationY: y } = e.nativeEvent;
        if (pointCount.current >= MAX_POINTS_PER_STROKE) {
          setCommittedPaths((prev) => [...prev, currentPathRef.current]);
          updateCurrentPath(`M${x.toFixed(1)},${y.toFixed(1)}`);
          pointCount.current = 1;
          return;
        }
        updateCurrentPath(`${currentPathRef.current} L${x.toFixed(1)},${y.toFixed(1)}`);
        pointCount.current += 1;
      },
      onPanResponderRelease: () => {
        commitCurrentPath();
        onChange?.(false);
      },
      // Something upstream stole the gesture anyway (despite refusing the
      // request above) -- keep whatever was drawn so far rather than
      // losing the stroke entirely.
      onPanResponderTerminate: () => commitCurrentPath(),
    }),
  ).current;

  const isEmpty = committedPaths.length === 0 && currentPath === "";

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        height,
        backgroundColor: "#ffffff",
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#cbd5e1",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {isEmpty && <Text style={{ color: "#94a3b8", fontSize: 13 }}>Sign here</Text>}
      <Svg
        ref={svgRef}
        height="100%"
        width="100%"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
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
