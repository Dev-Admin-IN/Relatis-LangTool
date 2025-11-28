import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TokenEditorComponent } from './token-editor/token-editor.component';

const routes: Routes = [
  { path: 'lang', component: TokenEditorComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
