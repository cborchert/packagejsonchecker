import { useEffect, useState } from "react";

import "./App.css";

type PackageInfo = {
  name: string;
  version: string;
  versionPublished: string;
  peerDependencies: { [k: string]: string };
  latestVersion: string;
  latestVersionPublished: string;
  latestVersionPeerDependencies: { [k: string]: string };
  nextVersion: string;
  nextVersionPublished: string;
  nextVersionPeerDependencies: { [k: string]: string };
  link: string;
  repositoryLink: string;
};

const fetchPackageInfo = async (
  packageName: string,
  semver: string
): Promise<PackageInfo> => {
  const version = semver.replace(/^\^/, "");
  const url = `https://registry.npmjs.org/${packageName}`;
  const response = await fetch(url);
  const json = await response.json();

  const { versions, time, "dist-tags": tags = {}, repository } = json;

  const currentVersionPublished = time[version];
  const currentVersionPeerDependencies = versions[version]?.peerDependencies;

  const versionsKeys = Object.keys(versions);

  const currentVersionIndex = versionsKeys.indexOf(version);

  const nextVersion = versionsKeys[currentVersionIndex + 1];
  const nextVersionPublished = time[nextVersion];
  const nextVersionPeerDependencies = versions[nextVersion]?.peerDependencies;

  const latestVersion = tags.latest || versionsKeys[versionsKeys.length - 1];
  const latestVersionPublished = time[latestVersion];
  const latestVersionPeerDependencies =
    versions[latestVersion]?.peerDependencies;

  const repositoryLink = (repository?.url || "")
    .replace("git+", "")
    .replace(".git", "");

  return {
    name: packageName,
    version,
    versionPublished: currentVersionPublished,
    peerDependencies: currentVersionPeerDependencies,
    latestVersion,
    latestVersionPublished,
    latestVersionPeerDependencies,
    nextVersion,
    nextVersionPublished,
    nextVersionPeerDependencies,
    link: `https://www.npmjs.com/package/${packageName}`,
    repositoryLink,
  };
};

const getPackagesInfo = async (
  packageJson: string,
  cb: (arg0: PackageInfo[]) => void
) => {
  try {
    const packages = JSON.parse(packageJson);
    const { devDependencies, dependencies } = packages;
    const allDependencies: { [k: string]: string } = {
      ...devDependencies,
      ...dependencies,
    };
    const allDependenciesNames = Object.keys(allDependencies);
    const promises = allDependenciesNames.map((packageName) => {
      const semver = allDependencies[packageName];
      return fetchPackageInfo(packageName, semver);
    });
    const data = await Promise.all(promises);
    cb(data);
  } catch (e) {
    // do nothing
  }
};

function usePerservedState<T>(
  key: string,
  defaultValue: any,
  parse: boolean = true
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState(() => {
    const valueInLocalStorage = localStorage.getItem(key);
    try {
      if (typeof valueInLocalStorage === "string") {
        return parse ? JSON.parse(valueInLocalStorage) : valueInLocalStorage;
      }
    } catch (e) {
      // do nothing
    }
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  });

  useEffect(() => {
    // when the value changes, set the new value in localStorage
    const valueToStore = parse ? JSON.stringify(state) : state;
    localStorage.setItem(key, valueToStore);
  }, [state]);

  return [state, setState];
}

function App() {
  const [packageJson, setPackageJson] = usePerservedState<string>(
    "packageJson",
    "{\n  \n}",
    false
  );
  const [isValid, setIsValid] = useState<boolean>(false);
  const [data, setData] = useState<PackageInfo[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [packageLevels, setPackageLevels] = usePerservedState<{
    [k: string]: void | "ok" | "warn" | "danger";
  }>("packageLevels", {});
  const [packageNotes, setPackageNotes] = usePerservedState<{
    [k: string]: string;
  }>("packageNotes", {});

  useEffect(() => {
    try {
      JSON.parse(packageJson);
      setIsValid(true);
      setDataLoading(true);
      getPackagesInfo(packageJson, (d) => {
        setData(d), setDataLoading(false);
      });

    } catch (e) {
      setIsValid(false);
    }
  }, [packageJson]);

  const okPackages = data.filter(
    (packageInfo) => packageLevels[packageInfo.name] === "ok"
  );
  const warnPackages = data.filter(
    (packageInfo) => packageLevels[packageInfo.name] === "warn"
  );
  const dangerPackages = data.filter(
    (packageInfo) => packageLevels[packageInfo.name] === "danger"
  );

  return (
    <div className="App">
      <h1>Package.json checker</h1>
      <p>
        Copy and paste your package.json file into the
        textarea, and then review the information presented. You can mark
        packages as "ok", "warn" or "danger" by clicking on the corresponding
        button. All data is stored in your browser's local storage, so you can
        come back to review your work later.
      </p>
      <div className="ClearAll">
        <button
          onClick={() => {
            setData([]);
            setPackageJson("");
            setPackageLevels({});
            setPackageNotes({})
          }}
        >
          Clear All
        </button>
      </div>
      <div className="PackageInput">
        <label>
          Your package.json
          <textarea
            value={packageJson}
            onChange={(e) => setPackageJson(e.target.value)}
          />
        </label>
        {!isValid && <div className="PackageInput__error">Invalid JSON</div>}
      </div>
      <div className="Packages">
        {dataLoading && <div className="Packages__loading">Loading...</div>}

        {!dataLoading &&
          data.map((packageInfo) => {
            const versions = [
              {
                version: packageInfo.version,
                peerDependencies: packageInfo.peerDependencies,
                published: packageInfo.versionPublished,
                description: "current",
              },
              {
                version: packageInfo.nextVersion,
                peerDependencies: packageInfo.nextVersionPeerDependencies,
                published: packageInfo.nextVersionPublished,
                description: "next",
              },
              {
                version: packageInfo.latestVersion,
                peerDependencies: packageInfo.latestVersionPeerDependencies,
                published: packageInfo.latestVersionPublished,
                description: "latest",
              },
            ];
            return (
              <div
                key={packageInfo.name}
                className={`Package ${packageLevels[packageInfo.name] || ""} `}
              >
                <div className="PackageHeader">
                  <h2>{packageInfo.name}</h2>
                  <a href={packageInfo.link} target="_blank" rel="noreferrer">
                    npm
                  </a>
                  <a
                    href={packageInfo.repositoryLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    repo
                  </a>
                  <button
                    className={
                      packageLevels[packageInfo.name] === "ok" ? "active" : ""
                    }
                    onClick={() => {
                      setPackageLevels((prev) => ({
                        ...prev,
                        [packageInfo.name]:
                          prev[packageInfo.name] === "ok" ? undefined : "ok",
                      }));
                    }}
                    title={`set ${packageInfo.name} to "ok"`}
                  >
                    ✔
                  </button>
                  <button
                    className={
                      packageLevels[packageInfo.name] === "warn" ? "active" : ""
                    }
                    onClick={() => {
                      setPackageLevels((prev) => ({
                        ...prev,
                        [packageInfo.name]:
                          prev[packageInfo.name] === "warn"
                            ? undefined
                            : "warn",
                      }));
                    }}
                    title={`set ${packageInfo.name} to "warn"`}
                  >
                    ⚠
                  </button>
                  <button
                    className={
                      packageLevels[packageInfo.name] === "danger"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setPackageLevels((prev) => ({
                        ...prev,
                        [packageInfo.name]:
                          prev[packageInfo.name] === "danger"
                            ? undefined
                            : "danger",
                      }));
                    }}
                    title={`set ${packageInfo.name} to "danger"`}
                  >
                    ✖
                  </button>
                  <input type="text" value={packageNotes[packageInfo.name] || ""} onChange={(e) => {
                    setPackageNotes((prev) => ({
                      ...prev,
                      [packageInfo.name]: e.target.value
                    }))
                  }} placeholder="notes" />
                </div>
                <div className="Infotable">
                  <div className="Infotable__row Infotable__row--header">
                    <div> version </div>
                    <div> date </div>
                    <div> peerDependencies </div>
                  </div>
                  {versions.map(
                    ({ version, description, published, peerDependencies }) => {
                      return (
                        <div
                          key={`${packageInfo.name} ${description} v${version}`}
                          className="Infotable__row"
                        >
                          <div>
                            {" "}
                            <strong>{description}</strong> {version}{" "}
                          </div>
                          <div> {published} </div>
                          <div>
                            {" "}
                            <ul>
                              {Object.keys(peerDependencies || {}).map(
                                (dep) => (
                                  <li>
                                    <strong>{dep}</strong>:{" "}
                                    {peerDependencies?.[dep]}
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <div>
        <h2>Summary</h2>
        <div>
          <h3>OK ({okPackages.length})</h3>
          {okPackages.length > 0 ? (
            <ul>
              {okPackages.map((d) => (
                <li>{d.name} {packageNotes[d.name] ? `(${packageNotes[d.name]})` : ''}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}
        </div>
        <div>
          <h3>Warn ({warnPackages.length})</h3>
          {warnPackages.length > 0 ? (
            <ul>
              {warnPackages.map((d) => (
                 <li>{d.name} {packageNotes[d.name] ? `(${packageNotes[d.name]})` : ''}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}
        </div>
        <div>
          <h3>Danger ({dangerPackages.length})</h3>
          {dangerPackages.length > 0 ? (
            <ul>
              {dangerPackages.map((d) => (
                 <li>{d.name} {packageNotes[d.name] ? `(${packageNotes[d.name]})` : ''}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
