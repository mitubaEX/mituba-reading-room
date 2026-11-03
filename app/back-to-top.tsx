'use client';
import {useEffect,useState} from 'react';
export default function BackToTop(){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{const update=()=>setVisible(window.scrollY>600);update();window.addEventListener('scroll',update,{passive:true});return()=>window.removeEventListener('scroll',update)},[]);
 return visible?<div className="back-top-dock"><button type="button" aria-label="ページのトップに戻る" onClick={()=>{window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});document.querySelector<HTMLElement>('main')?.focus({preventScroll:true})}}>↑ トップに戻る</button></div>:null;
}
