#[macro_use]
mod utils;
mod zip;

use js_sys::{Array, Error, eval};
use wasm_bindgen::prelude::*;
use wasm_bindgen::{Clamped, JsCast};
use std::io::Cursor;
use std::cmp;
use hex;

#[wasm_bindgen]
pub struct LSZR {
    eocd: zip::EOCD,
    entries: Vec<zip::CDHeader>,
}

#[wasm_bindgen]
#[derive(Copy, Clone)]
pub struct Range {
    #[wasm_bindgen(readonly, js_name=offset)]
    pub offset: u32,
    #[wasm_bindgen(readonly, js_name=size)]
    pub size: u32,
}

#[wasm_bindgen]
impl LSZR {
    #[wasm_bindgen(constructor, catch)]
    pub fn new(data: Vec<u8>) -> Result<LSZR, JsValue> {
        let len = data.len();
        if len < 22 {
            return Err(JsValue::from(Error::new("Data length invalid.")));
        }
        let mut reader = Cursor::new(data);
        let eocd = zip::parse_eocd(&mut reader)?;

        if eocd.number_of_this_disk != 0 || eocd.number_of_disk_start_eocd != 0 {
            return Err(JsValue::from(Error::new("Disk split is not supported.")));
        }

        if eocd.number_of_this_disk == 0xFFFF {
            return Err(JsValue::from(Error::new("ZIP64 is not supported.")));
        }
        
        let result = Self {
            eocd: eocd,
            entries: vec![]
        };

        Result::Ok(result)
    }

    #[wasm_bindgen(catch, js_name = parseCD)]
    pub fn parse_cd(&mut self, data: Vec<u8>) -> Result<Array, JsValue> {
        let mut reader = Cursor::new(data);
        self.entries = zip::parse_cd(
            &mut reader,
            self.eocd.total_number_of_entries_in_cd as usize,
        )?;

        let names = Array::new();
        for e in &self.entries {
            let name = JsValue::from(e.file_name.clone());
            names.push(&name);
        }
        Result::Ok(names)
    }

    #[wasm_bindgen(catch, js_name = getRange)]
    pub fn get_range(&mut self, name: String) -> Result<Range, JsValue> {
        for entry in &self.entries {
            if name == entry.file_name {
                let mut end = self.eocd.cd_offset;
                for next in &self.entries {
                    if next.relative_offset_of_local_header <= entry.relative_offset_of_local_header {
                        continue;
                    }
                    end = cmp::min(end, next.relative_offset_of_local_header);
                }
                return Result::Ok(Range {
                    offset: entry.relative_offset_of_local_header,
                    size: end - entry.relative_offset_of_local_header - 1,
                });
            }
        }
        let message = format!("Entry not found: {}", name);
        Err(JsValue::from(Error::new(message.as_str())))
    }

    #[wasm_bindgen(catch, js_name = getData)]
    pub fn get_data(&mut self, name: String, data: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let entry = self.find_entry(name)?;
        let reader = Cursor::new(data);
        let result = zip::load_file(reader, entry)?;

        if entry.is_encrypted {
            return Err(JsValue::from(Error::new("encrypted.")));
        }
        Ok(result)
    }

    fn find_entry(&self, name: String) -> Result<&zip::CDHeader, JsValue> {
        for entry in &self.entries {
            if entry.file_name == name {
                return Result::Ok(entry);
            }
        }
        Err(JsValue::from(Error::new("Entry not found.")))
    }

    #[wasm_bindgen(getter, js_name=cdRange)]
    pub fn cd_range(&self) -> Range {
        Range {
            offset: self.eocd.cd_offset,
            size: self.eocd.cd_size,
        }
    }

    #[wasm_bindgen(getter, js_name=eocdRange)]
    pub fn eocd_range(&self) -> Range {
        Range {
            offset: self.eocd.eocd_offset,
            size: self.eocd.eocd_size,
        }
    }
}

impl From<zip::ParseEOCDError> for JsValue {
    fn from(err: zip::ParseEOCDError) -> Self {
        JsValue::from(Error::new(
            match err {
                zip::ParseEOCDError::IOError(err) => format!("ParseEOCDError: {}", err),
                zip::ParseEOCDError::InvalidSignature => {
                    "ParseEOCDError: InvalidSignature".to_string()
                }
                zip::ParseEOCDError::TooShortDataLength => {
                    "ParseEOCDError: TooShortDataLength".to_string()
                }
            }
            .as_str(),
        ))
    }
}

impl From<zip::ParseCDError> for JsValue {
    fn from(err: zip::ParseCDError) -> Self {
        JsValue::from(Error::new(
            match err {
                zip::ParseCDError::IOError(err) => format!("ParseCDError: {}", err),
                zip::ParseCDError::FileNameConversionError => {
                    format!("ParseCDError: FileNameConversionError")
                }
                zip::ParseCDError::InvalidSignature => "ParseCDError: InvalidSignature".to_string(),
            }
            .as_str(),
        ))
    }
}

impl From<zip::LoadFileError> for JsValue {
    fn from(err: zip::LoadFileError) -> Self {
        JsValue::from(Error::new(
            match err {
                zip::LoadFileError::IOError(err) => format!("LoadFileError: {}", err),
                zip::LoadFileError::InvalidSignature => "LoadFileError: InvalidSignature".to_string(),
                zip::LoadFileError::UnmatchHeader => "LoadFileError: UnmatchHeader".to_string(),
                zip::LoadFileError::UnsupportedCompressionMethod(m) => format!("LoadFileError: UnsupportedCompressionMethod: {}", m),
                zip::LoadFileError::FileNameConversionError => "LoadFileError: FileNameConversionError".to_string(),
            }
            .as_str(),
        ))
    }
}
