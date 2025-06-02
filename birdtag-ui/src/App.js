import logo from './logo.svg';
import './App.css';
import React from 'react';
import UploadForm from './components/UploadingFiles';
import SpeciesSearch from './components/SpeciesSearch.js';
import BirdTagSearch from './components/TagBasedSearch.js';
import ThumbnailSearch from './components/ThumbnailSearch.js';
import { useAuth } from "react-oidc-context";

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "4h5dp0m9cjkkr2ld7lc98fhufe";
    const logoutUri = "http://localhost:3000";
    const cognitoDomain = "https://ap-southeast-2frkp14bgu.auth.ap-southeast-2.amazoncognito.com";
    auth.removeUser();
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  
    // Remove local tokens
    

  // Redirect to the logout endpoint, and after logout, automatically redirect back to Hosted UI login
    
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }
  
  if (!auth.isAuthenticated) {
    return (
      <div className="App">
        <h1>BirdTag App</h1>
        <p>You must sign in to continue</p>
        <button onClick={() => auth.signinRedirect()}>Sign In</button>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>BirdTag App</h1>
      <p>Welcome, {auth.user?.profile.email}</p>
      <button onClick={signOutRedirect}>Sign Out</button>
      <UploadForm />
      <hr />
      <SpeciesSearch />
      <hr />
      <BirdTagSearch />
      <hr />
      <ThumbnailSearch />
    </div>
  );
}

export default App;







//   <div className="App">
  //     <header className="App-header">
  //       <img src={logo} className="App-logo" alt="logo" />
  //       <p>
  //         Edit <code>src/App.js</code> and save to reload.
  //       </p>
  //       <a
  //         className="App-link"
  //         href="https://reactjs.org"
  //         target="_blank"
  //         rel="noopener noreferrer"
  //       >
  //         Learn React
  //       </a>
  //     </header>
  //   </div>
  // );