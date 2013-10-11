CREATE TABLE rooms (
    id         TEXT,
    configid   TEXT,
    name	   TEXT,
    width	   INTEGER,
    height	   INTEGER,
    registered TEXT,
    updated    TEXT
);

CREATE INDEX idx_rooms_id ON rooms (id);
CREATE INDEX idx_rooms_configid ON rooms (configid);
