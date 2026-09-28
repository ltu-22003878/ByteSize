export default function PixelAvatar({ avatar, size = 160 }) {
  const { skin, hair, hairStyle, outfit, accessory } = avatar;
  const px = size / 16; 

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      style={{ borderRadius: 20, background: "#ede9fe" }}
    >
      {/* neck/shoulders/outfit */}
      <rect x="4" y="12" width="8" height="4" fill={outfit} />
      <rect x="6" y="10" width="4" height="3" fill={skin} />

      {/* face */}
      <rect x="4" y="4" width="8" height="7" fill={skin} rx="1" />

      {/* hair styles */}
      {hairStyle === "short" && <rect x="3" y="3" width="10" height="3" fill={hair} />}
      {hairStyle === "long" && (
        <>
          <rect x="3" y="3" width="10" height="3" fill={hair} />
          <rect x="3" y="6" width="2" height="6" fill={hair} />
          <rect x="11" y="6" width="2" height="6" fill={hair} />
        </>
      )}
      {hairStyle === "curly" && (
        <>
          <rect x="3" y="2" width="10" height="4" fill={hair} />
          <rect x="2" y="4" width="2" height="3" fill={hair} />
          <rect x="12" y="4" width="2" height="3" fill={hair} />
        </>
      )}
      {hairStyle === "bald" && null}

      {/* eyes */}
      <rect x="5.5" y="7" width="1.2" height="1.2" fill="#1f1735" />
      <rect x="9.3" y="7" width="1.2" height="1.2" fill="#1f1735" />

      {/* mouth */}
      <rect x="6.5" y="9.5" width="3" height="0.8" fill="#7a4a3a" />

      {/* accessory */}
      {accessory === "glasses" && (
        <rect
          x="5"
          y="6.6"
          width="6"
          height="1.4"
          fill="none"
          stroke="#1f1735"
          strokeWidth="0.4"
        />
      )}
      {accessory === "cap" && <rect x="3" y="2" width="10" height="2" fill="#7c3aed" />}
    </svg>
  );
}
