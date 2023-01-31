import { Injectable, OnDestroy } from '@angular/core';
import {
    CannonWorkerAPI,
    CannonWorkerProps,
    CollideBeginEvent,
    CollideEndEvent,
    CollideEvent,
    RayhitEvent,
    Refs,
    Subscriptions,
} from '@pmndrs/cannon-worker-api';
import { NgtRxStore } from 'angular-three';

export type NgtcEvent = CollideBeginEvent | CollideEndEvent | CollideEvent | RayhitEvent;
export type NgtcCallbackByType<T extends { type: string }> = {
    [K in T['type']]?: T extends { type: K } ? (e: T) => void : never;
};

export type NgtcEvents = {
    [uuid: string]: Partial<NgtcCallbackByType<NgtcEvent>>;
};

export type NgtcScaleOverrides = { [uuid: string]: THREE.Vector3 };

export interface NgtcState {
    bodies: { [uuid: string]: number };
    events: NgtcEvents;
    refs: Refs;
    scaleOverrides: NgtcScaleOverrides;
    subscriptions: Subscriptions;
    worker: CannonWorkerAPI;
    init: (inputs: CannonWorkerProps) => void;
}

@Injectable()
export class NgtcStore extends NgtRxStore<NgtcState> implements OnDestroy {
    override initialize() {
        super.initialize();
        this.set({
            bodies: {},
            events: {},
            refs: {},
            scaleOverrides: {},
            subscriptions: {},
        });
    }
}
