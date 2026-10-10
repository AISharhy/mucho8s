import React, { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Send, Flag, Trash2, Video, BarChart3, Bell, Flame } from "lucide-react";
import { supabaseAuth, hasSupabaseAuth } from "@/lib/supabaseClient";
import { toast } from "sonner";

const twitchId = (url) => {
  try {
    const parsed = new URL(url);
    if (!["www.twitch.tv","twitch.tv","clips.twitch.tv"].includes(parsed.hostname) || parsed.protocol !== "https:") return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (parsed.hostname === "clips.twitch.tv") return { type:"clip", id:segments[0] };
    if (segments[1] === "clip") return { type:"clip", id:segments[2] };
    return { type:"channel", id:segments[0] };
  } catch { return null; }
};
const twitchEmbed = url => {
  const clip = twitchId(url);
  if (!clip || !/^[a-zA-Z0-9_-]+$/.test(clip.id || "")) return null;
  const parent = window.location.hostname;
  return clip.type === "clip"
    ? `https://clips.twitch.tv/embed?clip=${encodeURIComponent(clip.id)}&parent=${encodeURIComponent(parent)}`
    : `https://player.twitch.tv/?channel=${encodeURIComponent(clip.id)}&parent=${encodeURIComponent(parent)}`;
};
const panel = "rounded-2xl border border-[#252B36] bg-[#11161F] p-4 sm:p-5";
const field = "w-full rounded-xl border border-[#343B48] bg-[#0F1218] p-3 text-sm outline-none focus:border-magma/60";
const button = "rounded-xl border border-[#343B48] px-3 py-2 text-sm hover:border-magma/60 disabled:opacity-50";

export default function HubSocial() {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(false);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [polls, setPolls] = useState([]);
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [pollText, setPollText] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [sort, setSort] = useState("recent");
  const [expanded, setExpanded] = useState({});
  const [pollMode, setPollMode] = useState(false);

  const refresh = async (uid) => {
    if (!supabaseAuth || !uid) return;

    const names = ["hub_posts","hub_comments","hub_likes","hub_polls","hub_poll_options","hub_votes","hub_notifications"];
    const queries = names.map(n => {
      let q = supabaseAuth.from(n).select("*");
      if(n === "hub_posts") q=q.order("created_at",{ascending:false}).limit(60);
      if(n === "hub_notifications") q=q.eq("recipient_id",uid).order("created_at",{ascending:false}).limit(50);
      return q.limit(n === "hub_comments" ? 350 : 200);
    });
    const results = await Promise.all(queries);
    if (results[0].error) {
      setMember(false);
      return;
    }
    const {data:verified,error:membershipError}=await supabaseAuth.rpc("hub_member_status");
    setMember(!membershipError && verified===true);
    [setPosts,setComments,setLikes,setPolls,setOptions,setVotes,setNotifications].forEach((setter,i)=>setter(results[i].data || []));
    const images=(results[0].data||[]).filter(p=>p.media_kind==="image"&&p.media_url);
    const signed=await Promise.all(images.map(async p=>{
      const {data}=await supabaseAuth.storage.from("hub-media").createSignedUrl(p.media_url,3600);
      return [p.id,data?.signedUrl];
    }));
    setImageUrls(Object.fromEntries(signed.filter(row=>row[1])));
  };

  useEffect(() => {
    if (!supabaseAuth) return undefined;
    let active=true;
    supabaseAuth.auth.getUser().then(({data}) => {
      if(!active)return;
      setUser(data?.user || null);
      if(data?.user) refresh(data.user.id);
    });
    const {data:sub}=supabaseAuth.auth.onAuthStateChange((_event,session)=>{
      if(!active)return;
      setUser(session?.user || null);
      if(!session?.user){setMember(false);setPosts([]);}
    });
    return ()=>{active=false;sub.subscription.unsubscribe();};
  },[]);

  const run=async(fn)=>{
    setBusy(true);
    try {await fn(); await refresh(user.id);}
    catch(e){toast.error(e.message || "Hub action failed");}
    finally{setBusy(false);}
  };
  const check = (result) => {if(result.error)throw result.error;return result.data;};
  const publish=()=>run(async()=>{
    if(!body.trim()&&!media.trim()&&!imageFile)throw Error("Write a post or attach media");
    if(imageFile&&media.trim())throw Error("Choose either an image or a Twitch clip");
    if(media.trim()&&!twitchId(media.trim()))throw Error("Use a valid https:// Twitch channel or clip URL");
    if(pollMode) {
      const lines=pollText.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
      if(lines.length<2||lines.length>6||lines.some(v=>v.length>120))throw Error("Poll requires 2–6 options of max 120 characters");
    }
    let imageKey=null;
    if(imageFile){
      if(!["image/jpeg","image/png","image/webp"].includes(imageFile.type)||imageFile.size>5242880)throw Error("Only JPG, PNG or WebP up to 5 MB");
      imageKey=user.id+"/"+crypto.randomUUID()+"."+({"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[imageFile.type]);
      check(await supabaseAuth.storage.from("hub-media").upload(imageKey,imageFile,{contentType:imageFile.type,upsert:false}));
    }
    const post=check(await supabaseAuth.from("hub_posts").insert({
      author_id:user.id,body:body.trim(),media_url:imageKey||media.trim()||null,media_kind:imageKey?"image":media.trim()?"twitch":null
    }).select("id").single());
    const labels=pollText.split("\n").map(v=>v.trim()).filter(Boolean);
    if(pollMode) {
      if(labels.length<2||labels.length>6)throw Error("Poll requires 2–6 options, one per line");
      const poll=check(await supabaseAuth.from("hub_polls").insert({post_id:post.id,expires_at:new Date(Date.now()+86400000).toISOString()}).select("id").single());
      check(await supabaseAuth.from("hub_poll_options").insert(labels.map((label,position)=>({poll_id:poll.id,label,position}))));
    }
    setBody("");setMedia("");setImageFile(null);setPollText("");setPollMode(false);toast.success("Published");
  });
  const like=(post)=>run(async()=>{
    const liked=likes.some(l=>l.post_id===post.id&&l.user_id===user.id);
    check(liked?await supabaseAuth.from("hub_likes").delete().eq("post_id",post.id).eq("user_id",user.id):
      await supabaseAuth.from("hub_likes").insert({post_id:post.id,user_id:user.id}));
  });
  const comment=(post)=>run(async()=>{
    const value=(commentDrafts[post.id]||"").trim();
    if(!value)return;
    check(await supabaseAuth.from("hub_comments").insert({post_id:post.id,author_id:user.id,body:value}));
    setCommentDrafts(prev=>({...prev,[post.id]:""}));
  });
  const vote=(poll,optionId)=>run(async()=>{
    if(votes.some(v=>v.poll_id===poll.id&&v.user_id===user.id))return;
    check(await supabaseAuth.from("hub_votes").insert({poll_id:poll.id,option_id:optionId,user_id:user.id}));
  });
  const report=post=>{
    const reason=window.prompt("Reason for reporting this post (5–500 characters):");
    if(reason===null)return;
    run(async()=>{
      if(reason.trim().length<5)throw Error("Please explain the report");
      check(await supabaseAuth.from("hub_reports").insert({post_id:post.id,reporter_id:user.id,reason:reason.trim()}));
      toast.success("Report submitted");
    });
  };
  const remove=post=>run(async()=>{
    if(!window.confirm("Delete your post?"))return;
    check(await supabaseAuth.from("hub_posts").delete().eq("id",post.id).eq("author_id",user.id));
  });
  const ranked=useMemo(()=>{
    if(sort!=="popular")return posts;
    return [...posts].sort((a,b)=>{
      const score=p=>likes.filter(l=>l.post_id===p.id).length+comments.filter(c=>c.post_id===p.id).length*3;
      return score(b)-score(a);
    });
  },[posts,sort,likes,comments]);

  if(!hasSupabaseAuth)return <div className={panel}>Community posting requires the shared Supabase connection. Competitive activity remains available above.</div>;
  if(!user)return <div className={panel}>Sign in with your approved Circle account to post, vote and interact with the community.</div>;
  return <section className="space-y-4" aria-label="Circle social feed">
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-black">Circle Social</h2>
      <button className={button} onClick={()=>setShowAlerts(v=>!v)} aria-label="Notifications"><Bell size={17} className="inline mr-2"/>Notifications ({notifications.filter(n=>!n.is_read).length})</button>
    </div>
    {showAlerts&&<div className={panel}>
      {notifications.length===0?<p className="text-sm text-muted-foreground">No notifications yet.</p>:notifications.map(n=><div key={n.id} className="text-sm py-2 border-b border-[#252B36]">
        <span>{n.kind} on your post · {new Date(n.created_at).toLocaleDateString()}</span>
        {!n.is_read&&<button className="ml-3 text-[#D5A33A]" onClick={()=>run(async()=>check(await supabaseAuth.from("hub_notifications").update({is_read:true}).eq("id",n.id).eq("recipient_id",user.id)))}>Mark read</button>}
      </div>)}
    </div>}
    <div className={panel}>
      <textarea className={field} value={body} maxLength={2000} rows={3} onChange={e=>setBody(e.target.value)} placeholder="Share something with the Circle..." />
      <input className={field+" mt-2"} value={media} maxLength={500} onChange={e=>setMedia(e.target.value)} placeholder="Optional Twitch clip or channel HTTPS URL" />
      <label className="block text-xs text-muted-foreground mt-2">Image (JPG, PNG, WebP · max 5 MB)
        <input type="file" aria-label="Upload image" accept="image/jpeg,image/png,image/webp" className="block mt-2 text-xs" onChange={e=>setImageFile(e.target.files?.[0]||null)}/>
      </label>
      <div className="flex items-center justify-between mt-3 gap-2">
        <button className={button} onClick={()=>setPollMode(v=>!v)}><BarChart3 size={15} className="inline mr-1"/>Poll</button>
        <button className={button+" bg-magma text-white"} disabled={busy||!member} onClick={publish}><Send size={15} className="inline mr-1"/>Publish</button>
      </div>
      {pollMode&&<textarea value={pollText} onChange={e=>setPollText(e.target.value)} rows={4} maxLength={800} className={field+" mt-3"} placeholder="Poll answers, one option per line (2–6). Closes after 24 hours."/>}
      {!member&&<p className="text-xs text-muted-foreground mt-2">Checking Circle membership or database migration required.</p>}
    </div>
    <div className="flex gap-2">
      <button className={button} aria-pressed={sort==="recent"} onClick={()=>setSort("recent")}>Recent</button>
      <button className={button} aria-pressed={sort==="popular"} onClick={()=>setSort("popular")}><Flame size={14} className="inline mr-1"/>Popular</button>
    </div>
    {ranked.map(post=>{
      const postComments=comments.filter(c=>c.post_id===post.id);
      const postLikes=likes.filter(l=>l.post_id===post.id);
      const isLiked=postLikes.some(l=>l.user_id===user.id);
      const poll=polls.find(p=>p.post_id===post.id);
      const pollOptions=options.filter(o=>o.poll_id===poll?.id).sort((a,b)=>a.position-b.position);
      const myVote=votes.find(v=>v.poll_id===poll?.id&&v.user_id===user.id);
      const totalVotes=votes.filter(v=>v.poll_id===poll?.id).length;
      const embed=post.media_kind==="twitch"?twitchEmbed(post.media_url):null;
      return <article key={post.id} className={panel}>
        <div className="flex justify-between items-center gap-3 text-xs text-muted-foreground">
          <span>Circle member · {new Date(post.created_at).toLocaleString()}</span>
          {post.author_id===user.id?<button aria-label="Delete post" disabled={busy} onClick={()=>remove(post)}><Trash2 size={16}/></button>:<button aria-label="Report post" disabled={busy} onClick={()=>report(post)}><Flag size={16}/></button>}
        </div>
        {post.body&&<p className="whitespace-pre-wrap break-words mt-3 text-sm">{post.body}</p>}
        {post.media_kind==="image"&&imageUrls[post.id]&&<img className="rounded-xl mt-3 max-h-[480px] max-w-full object-contain" src={imageUrls[post.id]} alt="Community post attachment" loading="lazy"/>}
        {embed&&<div className="mt-3 aspect-video overflow-hidden rounded-xl"><iframe title="Twitch media" src={embed} allowFullScreen allow="autoplay; fullscreen" referrerPolicy="strict-origin-when-cross-origin" className="w-full h-full" /></div>}
        {poll&&<div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Poll · {totalVotes} votes · {new Date(poll.expires_at)>new Date()?"Open":"Closed"}</p>
          {pollOptions.map(o=>{
            const count=votes.filter(v=>v.option_id===o.id).length;
            return <button key={o.id} className={button+" w-full text-left"} disabled={busy||Boolean(myVote)||new Date(poll.expires_at)<=new Date()} onClick={()=>vote(poll,o.id)}>
              {o.label} {(myVote||new Date(poll.expires_at)<=new Date())&&<span className="float-right">{totalVotes?Math.round(count/totalVotes*100):0}%</span>}
            </button>;
          })}
        </div>}
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
          <button disabled={busy} onClick={()=>like(post)} aria-pressed={isLiked}><Heart size={15} fill={isLiked?"currentColor":"none"} className="inline mr-1"/>{postLikes.length}</button>
          <button onClick={()=>setExpanded(p=>({...p,[post.id]:!p[post.id]}))}><MessageCircle size={15} className="inline mr-1"/>{postComments.length} comments</button>
        </div>
        {expanded[post.id]&&<div className="border-t border-[#252B36] mt-3 pt-3 space-y-2">
          {postComments.map(c=><div key={c.id} className="text-xs rounded-lg bg-[#0F1218] p-3">{c.body}</div>)}
          <div className="flex gap-2">
            <input className={field} maxLength={500} value={commentDrafts[post.id]||""} onChange={e=>setCommentDrafts(p=>({...p,[post.id]:e.target.value}))} placeholder="Write a comment..." />
            <button className={button} disabled={busy} onClick={()=>comment(post)}>Send</button>
          </div>
        </div>}
      </article>;
    })}
  </section>;
}
