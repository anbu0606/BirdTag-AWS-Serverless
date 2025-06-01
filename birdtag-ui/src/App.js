import logo from './logo.svg';
import './App.css';
import React from 'react';
import UploadForm from './components/UploadingFiles';
import SpeciesSearch from './components/SpeciesSearch.js';

function App() {
  // return (
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
  return (
    <div className="App">
      <h1>BirdTag App</h1>
      <UploadForm />
      <hr/>
      <SpeciesSearch />
    </div>
  );
}

export default App;
