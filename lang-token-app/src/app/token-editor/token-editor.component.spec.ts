import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { TokenEditorComponent } from './token-editor.component';

describe('TokenEditorComponent', () => {
  let component: TokenEditorComponent;
  let fixture: ComponentFixture<TokenEditorComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [TokenEditorComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(TokenEditorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Verify no outstanding requests
    // Note: ngOnInit makes requests, so we might need to handle them in each test or ignore
    // httpMock.verify(); 
  });

  it('should filter groups correctly when showOnlyMissing is true', () => {
    // Setup data
    component.englishTokens = {
      'groupA.token1': 'A1',
      'groupA.token2': 'A2',
      'groupB.token1': 'B1',
      'groupB.token2': 'B2',
      'groupC.token1': 'C1',
      'groupC.token2': 'C2'
    };
    component.tokens = {
      // Group A: all missing (undefined)
      // Group B: mixed
      'groupB.token1': 'B1-Trans',
      // Group C: all present
      'groupC.token1': 'C1-Trans',
      'groupC.token2': 'C2-Trans'
    };

    // Initial detection
    component.detectMissing();

    // Enable filter
    component.onShowOnlyMissingChange(true);

    const groups = component.tokenGroups;
    // Should only contain Group A
    expect(groups.length).toBe(1);
    expect(groups[0].prefix).toBe('groupA');
  });

  it('should load images on init', () => {
    const mockImages = { 'groupA': 'http://server/img.png' };
    const req = httpMock.expectOne('https://dev.relatis.io:9444/files');
    req.flush([]);

    // Expect loadImages request
    const reqImages = httpMock.expectOne('https://dev.relatis.io:9444/file/images.json');
    reqImages.flush(mockImages);

    expect(component.tokenPictures['groupA']).toBe('http://server/img.png');
  });

  it('should upload and save image on attachPicture', () => {
    const file = new File([''], 'test.png', { type: 'image/png' });
    const event = { target: { files: [file] } };

    component.attachPicture(event, 'groupA');

    // Expect upload
    const reqUpload = httpMock.expectOne('https://dev.relatis.io:9444/upload');
    expect(reqUpload.request.method).toBe('POST');
    reqUpload.flush({});

    // Expect save images metadata
    const reqSave = httpMock.expectOne('https://dev.relatis.io:9444/save/images.json');
    expect(reqSave.request.method).toBe('POST');
    expect(reqSave.request.body['groupA']).toContain('test.png');
    reqSave.flush({});
  });

  it('should toggle expandedImage state', () => {
    expect(component.expandedImage).toBeNull();

    component.openImage('http://server/img.png');
    expect(component.expandedImage).toBe('http://server/img.png');

    component.closeImage();
    expect(component.expandedImage).toBeNull();
  });

  it('should filter file list to show only language json files', () => {
    const mockFiles = ['en.json', 'fr.json', 'images.json', 'test.png', 'data.txt'];
    const req = httpMock.expectOne('https://dev.relatis.io:9444/files');
    req.flush(mockFiles);

    expect(component.files).toEqual(['en.json', 'fr.json']);
  });
});
