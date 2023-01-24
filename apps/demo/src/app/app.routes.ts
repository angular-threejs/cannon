import { Route } from '@angular/router';

export const routes: Route[] = [
    { path: '', redirectTo: 'cubes', pathMatch: 'full' },
    { path: 'cubes', loadComponent: () => import('./simple-cubes/simple-cubes.component') },
];
