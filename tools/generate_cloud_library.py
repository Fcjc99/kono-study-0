#!/usr/bin/env python3
from pathlib import Path
import cv2
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'public/garden/islands/stage-0/stage0-afternoon.png'
OUT=ROOT/'public/garden/clouds'
BOXES=[
    (0,55,340,285),
    (170,20,390,120),
    (755,0,1135,225),
    (1040,70,1448,305),
    (1160,15,1410,110),
]

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    bgr=cv2.imread(str(SRC),cv2.IMREAD_COLOR)
    for i,(x0,y0,x1,y1) in enumerate(BOXES,1):
        crop=bgr[y0:y1,x0:x1]
        hsv=cv2.cvtColor(crop,cv2.COLOR_BGR2HSV)
        h,s,v=cv2.split(hsv)
        mask=(((v>=175)&(s<=78))|((v>=218)&(s<=105))).astype(np.uint8)*255
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8),iterations=2)
        count,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
        cleaned=np.zeros_like(mask)
        for idx in range(1,count):
            if stats[idx,cv2.CC_STAT_AREA] >= 140:
                cleaned[labels==idx]=255
        alpha=cv2.GaussianBlur(cleaned,(0,0),2.2)
        rgb=cv2.cvtColor(crop,cv2.COLOR_BGR2RGB).astype(np.float32)
        edge=(alpha.astype(np.float32)/255.0)[...,None]
        paper=np.array([255,249,239],np.float32)
        rgb=np.clip(rgb*edge + paper*(1-edge),0,255).astype(np.uint8)
        bgra=np.dstack([rgb[:,:,2],rgb[:,:,1],rgb[:,:,0],alpha])
        cv2.imwrite(str(OUT/f'cloud-{i:02d}.png'),bgra,[cv2.IMWRITE_PNG_COMPRESSION,3])

if __name__=='__main__': main()
