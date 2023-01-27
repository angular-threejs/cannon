import { Route } from '@angular/router';

export const routes: Route[] = [
    { path: '', redirectTo: 'simple-cubes', pathMatch: 'full' },
    { path: 'simple-cubes', loadComponent: () => import('./simple-cubes/simple-cubes.component') },
    { path: 'compound-body', loadComponent: () => import('./compound-body/compound-body.component') },
];
