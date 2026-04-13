const VideoTile = ({
  title,
  subtitle,
  videoRef,
  muted = false,
  videoEnabled = true,
  audioEnabled = true,
  pinned = false,
  canPin = false,
  onTogglePin,
  avatarUrl,
}) => {
  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        pinned ? "border-indigo-400" : "border-slate-700 dark:border-slate-800"
      } bg-white dark:bg-slate-900`}
    >
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`h-full w-full object-cover ${videoEnabled ? "opacity-100" : "opacity-0"}`}
        />
        {!videoEnabled ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={title}
                className="h-24 w-24 rounded-full border border-slate-500 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-slate-500 bg-slate-700 text-3xl font-semibold text-slate-100">
                {(title || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        ) : null}
        {canPin ? (
          <button
            type="button"
            title={pinned ? "Unpin participant" : "Pin participant"}
            onClick={onTogglePin}
            className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
        ) : null}
        <div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white">
          {audioEnabled ? <TileMicOnIcon /> : <TileMicOffIcon />}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={title} className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {(title || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
        </div>
        {subtitle ? <span className="text-slate-500 dark:text-slate-400">{subtitle}</span> : null}
      </div>
    </div>
  );
};

const TileMicOnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5v2.5" />
  </svg>
);

const TileMicOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5 11.5a7 7 0 0 0 14 0" />
    <path d="M12 18.5v2.5" />
    <path d="M4 4l16 16" />
  </svg>
);

export default VideoTile;
