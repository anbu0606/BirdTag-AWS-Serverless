import './App.css';
import React, { useState } from 'react';
import UploadForm from './components/UploadingFiles';
import SpeciesSearch from './components/SpeciesSearch';
import BirdTagSearch from './components/TagBasedSearch';
import ThumbnailSearch from './components/ThumbnailSearch';
import BulkTagging from './components/ManualTagging';
import DeleteFiles from './components/DeleteFiles.js';
import { useAuth } from 'react-oidc-context';

function App() {
  const auth = useAuth();
  const [selectedFeature, setSelectedFeature] = useState(null);

  const signOutRedirect = () => {
    const clientId = '4h5dp0m9cjkkr2ld7lc98fhufe';
    const logoutUri = 'http://localhost:3000';
    const cognitoDomain = 'https://ap-southeast-2frkp14bgu.auth.ap-southeast-2.amazoncognito.com';

    auth.removeUser();
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) return <div>Loading...</div>;
  if (auth.error) return <div>Encountered error... {auth.error.message}</div>;

  if (!auth.isAuthenticated) {
    return (
      <div className="not-auth">
        <div className = "content-start">
          <h1>Welcome to the BirdTag App</h1>
          <p>Help us protect and understand our feathered friends! 
             Our app enables the following:
          </p>
          <div className='left-align-list'>
            <ul>
              <li>Upload images, audio, and video of bird sightings</li>
              <li>Our system auto-tags each file with the bird species it detects</li>
              <li>Search for media by species name</li>
              <li>All files are stored securely and centrally to support bird research and conservation</li>
            </ul>
          </div>
          <br></br>
          <br></br>
          <button className = "first-button" onClick={() => auth.signinRedirect()}>Get Started!</button>
        </div>
      </div>
    );
  }

  const renderFeature = () => {
    switch (selectedFeature) {
      case 'upload':
        return <UploadForm />;
      case 'speciesSearch':
        return <SpeciesSearch />;
      case 'tagSearch':
        return <BirdTagSearch />;
      case 'thumbnailSearch':
        return <ThumbnailSearch />;
      case 'bulkTagging':
        return <BulkTagging />;
      case 'deletefiles':
        return <DeleteFiles />;
      default:
        return <p>Select a feature from the menu above to begin</p>;
    }
  };

  return (
    <>
      {/* Flying birds background */}
      <div className="bird-animation-bg">
        <div className="bird-container bird-container-one">
          <div className="bird bird-one"></div>
        </div>
        <div className="bird-container bird-container-two">
          <div className="bird bird-two"></div>
        </div>
        <div className="bird-container bird-container-three">
          <div className="bird bird-three"></div>
        </div>
        <div className="bird-container bird-container-four">
          <div className="bird bird-four"></div>
        </div>
      </div>

      {/*  Main App UI */}
      <div className="App">
        <h1> BirdTag App</h1>
        <p>Welcome, {auth.user?.profile.email}</p>
        <button onClick={signOutRedirect}>Sign Out</button>

        <div className="menu">
          <button className="button-73" onClick={() => setSelectedFeature('upload')}>Upload Media</button>
          <button className="button-73" onClick={() => setSelectedFeature('speciesSearch')}>Search by Species</button>
          <button className="button-73" onClick={() => setSelectedFeature('tagSearch')}>Search by Tags</button>
          <button className="button-73" onClick={() => setSelectedFeature('thumbnailSearch')}>Full Image from Thumbnail</button>
          <button className="button-73" onClick={() => setSelectedFeature('bulkTagging')}>Bulk Tag Updater</button>
          <button className="button-73" onClick={() => setSelectedFeature('deletefiles')}>Delete Files permanently</button>
        </div>

        <div className="feature-panel">{renderFeature()}</div>

        
        <h3> Not implemented yet: </h3>
        <h2>Subscribe to Bird Tag Notifications</h2>
        <input type="text" placeholder="Enter bird species e.g. crow" />
        <button>Subscribe</button>
        <p>We will notify you by email when new media for this bird is added.</p>

      </div>
    </>
  );
}

export default App;
