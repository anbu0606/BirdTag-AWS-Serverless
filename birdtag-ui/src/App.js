import './App.css';
import React, { useState } from 'react';
import UploadForm from './components/UploadingFiles';
import SpeciesSearch from './components/SpeciesSearch';
import BirdTagSearch from './components/TagBasedSearch';
import ThumbnailSearch from './components/ThumbnailSearch';
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
      <div className="App">
        <h1>BirdTag App</h1>
        <p>You must sign in to continue</p>
        <button onClick={() => auth.signinRedirect()}>Sign In</button>
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
        </div>

        <div className="feature-panel">{renderFeature()}</div>
      </div>
    </>
  );
}

export default App;
