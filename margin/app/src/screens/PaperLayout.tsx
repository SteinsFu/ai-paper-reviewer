import { useEffect } from "react";
import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { useReview } from "../hooks/useReview";
import { useAppState } from "../state/AppState";
import type { ReviewBundle } from "../services/types";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { ErrorState } from "../components/ErrorState";

interface PaperCtx { bundle: ReviewBundle; paperId: string }

/* Loads the review bundle once per paper and shares it with all paper tabs
   (and, via AppState, with the sidebar badge / topbar / chat). */
export function PaperLayout() {
  const { id = "p1" } = useParams();
  const { data, loading, error, reload } = useReview(id);
  const { setBundle, setCurrentPaper } = useAppState();

  // opening a paper focuses the workspace on it (sidebar, current-paper card, badges)
  useEffect(() => { setCurrentPaper(id); }, [id, setCurrentPaper]);

  useEffect(() => {
    if (data) setBundle(data);
  }, [data, setBundle]);

  if (error && !loading) {
    return (
      <div className="screen-scroll scroll">
        <ErrorState
          title="Couldn't load this review"
          message="The review data didn't come through. Check your connection and try again."
          onRetry={reload}
        />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="screen-scroll scroll">
        <div style={{ maxWidth:920, margin:"0 auto", padding:"34px 38px" }}>
          <div style={{ display:"flex", gap:20, alignItems:"center", marginBottom:28 }}>
            <Skeleton w={62} h={62} r={99}/>
            <div style={{ flex:1 }}>
              <Skeleton w="70%" h={20} style={{ marginBottom:10 }}/>
              <Skeleton w="38%" h={13}/>
            </div>
          </div>
          {[0,1,2].map((i) => <div key={i} style={{ marginBottom:14 }}><SkeletonCard height={110}/></div>)}
        </div>
      </div>
    );
  }

  return <Outlet context={{ bundle: data, paperId: id } satisfies PaperCtx}/>;
}

export function usePaperBundle(): PaperCtx {
  return useOutletContext<PaperCtx>();
}
